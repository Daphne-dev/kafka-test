import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer, EachBatchPayload } from 'kafkajs';
import { Message } from '../interfaces/message.interface';
import { Counter, Gauge, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private readonly topic = 'high-throughput-topic';
  private readonly groupId = 'high-throughput-group';
  private isConsuming = false;
  private messageCount = 0;
  private startTime: number;
  private lastLogTime: number;

  constructor(
    @InjectMetric('kafka_consumer_messages_total')
    private readonly messageCounter: Counter<string>,
    @InjectMetric('kafka_consumer_throughput')
    private readonly throughputGauge: Gauge<string>,
    @InjectMetric('kafka_message_processing_time_seconds')
    private readonly processingTimeHistogram: Histogram<string>,
    @InjectMetric('kafka_consumer_lag')
    private readonly lagGauge: Gauge<string>,
  ) {
    this.kafka = new Kafka({
      clientId: 'high-throughput-consumer',
      brokers: ['kafka1:9092', 'kafka2:9092', 'kafka3:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: this.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 10485760, // 10MB
      maxWaitTimeInMs: 50,
      readUncommitted: true, // 커밋되지 않은 메시지도 읽기
    });
  }

  async onModuleInit() {
    await this.consumer.connect();
    console.log('Consumer connected to Kafka');
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    console.log('Consumer disconnected from Kafka');
  }

  async startConsuming() {
    if (this.isConsuming) {
      console.log('Already consuming messages');
      return;
    }

    this.isConsuming = true;
    this.messageCount = 0;
    this.startTime = Date.now();
    this.lastLogTime = Date.now();

    console.log('Starting to consume messages');

    await this.consumer.subscribe({
      topic: this.topic,
      fromBeginning: false,
    });

    this.startLagMonitoring();

    await this.consumer.run({
      partitionsConsumedConcurrently: 8, // 동시에 처리할 파티션 수 증가
      eachBatch: async (payload: EachBatchPayload) => {
        try {
          const batchStartTime = Date.now();
          const { batch, isRunning, resolveOffset, heartbeat } = payload;
          const { messages } = batch;

          if (!isRunning() || !this.isConsuming) return;

          // 배치 단위로 메시지 처리
          for (const message of messages) {
            if (!isRunning() || !this.isConsuming) break;

            try {
              const messageValue = message.value.toString();
              const parsedMessage: Message = JSON.parse(messageValue);

              // 오프셋 해결 및 하트비트 전송
              resolveOffset(message.offset);
            } catch (err) {
              console.error('Error processing message:', err);
            }
          }

          // 배치 처리 완료 후 메시지 카운트 증가
          this.messageCount += messages.length;

          // Prometheus 메트릭 업데이트
          this.messageCounter.inc(messages.length);

          // 처리 시간 측정 및 히스토그램에 기록
          const processingTimeInSeconds = (Date.now() - batchStartTime) / 1000;
          this.processingTimeHistogram.observe(
            { operation: 'consume', topic: this.topic },
            processingTimeInSeconds,
          );

          // 하트비트 전송
          await heartbeat();

          // 1초마다 처리량 로그 출력
          const now = Date.now();
          if (now - this.lastLogTime >= 1000) {
            const elapsedSeconds = (now - this.startTime) / 1000;
            const currentThroughput = this.messageCount / elapsedSeconds;

            // 처리량 메트릭 업데이트
            this.throughputGauge.set(currentThroughput);

            console.log(
              `Consumed ${this.messageCount} messages in ${elapsedSeconds.toFixed(2)} seconds`,
            );
            console.log(
              `Current throughput: ${currentThroughput.toFixed(2)} messages/second`,
            );
            this.lastLogTime = now;
          }
        } catch (error) {
          console.error('Error processing batch:', error);
        }
      },
    });
  }

  async stopConsuming() {
    if (!this.isConsuming) {
      console.log('Not consuming messages');
      return;
    }

    await this.consumer.stop();
    this.isConsuming = false;

    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    console.log(
      `Stopped consuming messages. Processed ${this.messageCount} messages in ${elapsedSeconds.toFixed(2)} seconds`,
    );
    console.log(
      `Average throughput: ${(this.messageCount / elapsedSeconds).toFixed(2)} messages/second`,
    );

    // 메트릭 업데이트 중지
    this.throughputGauge.set(0);

    // 지연(lag) 메트릭 초기화
    this.lagGauge.reset();
  }

  getStats() {
    if (!this.isConsuming || this.messageCount === 0) {
      return {
        isConsuming: this.isConsuming,
        messageCount: 0,
        elapsedSeconds: 0,
        throughput: 0,
      };
    }

    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    return {
      isConsuming: this.isConsuming,
      messageCount: this.messageCount,
      elapsedSeconds: parseFloat(elapsedSeconds.toFixed(2)),
      throughput: parseFloat((this.messageCount / elapsedSeconds).toFixed(2)),
    };
  }

  private async startLagMonitoring() {
    // 10초마다 컨슈머 지연 업데이트
    const lagMonitoringInterval = setInterval(async () => {
      if (!this.isConsuming) {
        clearInterval(lagMonitoringInterval);
        return;
      }

      try {
        // 토픽의 최신 오프셋 가져오기
        const admin = this.kafka.admin();
        await admin.connect();

        const topicOffsets = await admin.fetchTopicOffsets(this.topic);

        // 컨슈머 그룹의 현재 오프셋 가져오기
        const consumerOffsetsResponse = await admin.fetchOffsets({
          groupId: this.groupId,
          topics: [this.topic],
        });

        // 해당 토픽의 오프셋 정보 찾기
        const topicOffsetInfo = consumerOffsetsResponse.find(
          (item) => item.topic === this.topic,
        );

        if (topicOffsetInfo) {
          // 각 파티션별 지연(lag) 계산 및 메트릭 업데이트
          for (const topicOffset of topicOffsets) {
            const partition = topicOffset.partition;
            const latestOffset = parseInt(topicOffset.offset);

            // 해당 파티션의 컨슈머 오프셋 찾기
            const consumerPartitionOffset = topicOffsetInfo.partitions.find(
              (p) => p.partition === partition,
            );

            if (consumerPartitionOffset) {
              const currentOffset = parseInt(consumerPartitionOffset.offset);
              const lag = latestOffset - currentOffset;

              // 지연(lag) 메트릭 업데이트
              this.lagGauge.set(
                {
                  topic: this.topic,
                  groupId: this.groupId,
                  partition: partition.toString(),
                },
                lag,
              );

              // 로그에 지연 정보 출력 (디버깅용)
              console.log(`Partition ${partition} lag: ${lag} messages`);
            }
          }
        }

        await admin.disconnect();
      } catch (error) {
        console.error('Error monitoring consumer lag:', error);
      }
    }, 10000); // 10초마다 실행
  }
}
