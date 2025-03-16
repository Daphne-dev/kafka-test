import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, Partitioners } from 'kafkajs';
import { Message } from '../interfaces/message.interface';
import { Counter, Gauge, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly topic = 'high-throughput-topic';
  private isProducing = false;
  // 목표 처리량 설정
  private targetMinThroughput = 10000; // 최소 초당 10,000개
  private targetMaxThroughput = 11000; // 최대 초당 11,000개
  private batchSize = 1000; // 더 작은 배치 크기로 조정
  private batchCount = 2; // 더 적은 병렬 배치로 조정
  private messageCount = 0;
  private startTime: number;
  private lastBatchTime: number;

  constructor(
    @InjectMetric('kafka_producer_messages_total')
    private readonly messageCounter: Counter<string>,
    @InjectMetric('kafka_producer_throughput')
    private readonly throughputGauge: Gauge<string>,
    @InjectMetric('kafka_message_processing_time_seconds')
    private readonly processingTimeHistogram: Histogram<string>,
  ) {
    this.kafka = new Kafka({
      clientId: 'high-throughput-producer',
      brokers: ['kafka1:9092', 'kafka2:9092', 'kafka3:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
      createPartitioner: Partitioners.DefaultPartitioner, // 명시적으로 파티셔너 설정
    });
  }

  async onModuleInit() {
    await this.producer.connect();
    console.log('Producer connected to Kafka');
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    console.log('Producer disconnected from Kafka');
  }

  async startProducing() {
    if (this.isProducing) {
      console.log('Already producing messages');
      return;
    }

    this.isProducing = true;
    this.messageCount = 0;
    this.startTime = Date.now();

    console.log(`Starting to produce messages at maximum throughput`);

    // 단일 프로듀서 루프 시작 (최대 속도로 실행)
    this.produceMessages();
  }

  async stopProducing() {
    this.isProducing = false;
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    console.log(
      `Stopped producing messages. Sent ${this.messageCount} messages in ${elapsedSeconds.toFixed(2)} seconds`,
    );
    console.log(
      `Average throughput: ${(this.messageCount / elapsedSeconds).toFixed(2)} messages/second`,
    );

    // 메트릭 업데이트 중지
    this.throughputGauge.set(0);
  }

  private async produceMessages() {
    if (!this.isProducing) return;

    try {
      const batchStartTime = Date.now();
      this.lastBatchTime = batchStartTime;

      // 여러 배치를 병렬로 전송
      const promises = [];

      for (let i = 0; i < this.batchCount; i++) {
        const messages = this.generateMessages(this.batchSize);
        promises.push(
          this.producer.send({
            topic: this.topic,
            // compression: CompressionTypes.GZIP,
            messages: messages,
          }),
        );
      }

      await Promise.all(promises);

      // 처리 시간 측정 및 히스토그램에 기록
      const processingTimeInSeconds = (Date.now() - batchStartTime) / 1000;
      this.processingTimeHistogram.observe(
        { operation: 'produce', topic: this.topic },
        processingTimeInSeconds,
      );

      const batchTotalSize = this.batchSize * this.batchCount;
      this.messageCount += batchTotalSize;

      // Prometheus 메트릭 업데이트
      this.messageCounter.inc(batchTotalSize);

      // 처리량 계산 및 메트릭 업데이트
      const elapsedSeconds = (Date.now() - this.startTime) / 1000;
      const currentThroughput = this.messageCount / elapsedSeconds;
      this.throughputGauge.set(currentThroughput);

      // 목표 처리량에 맞게 지연 시간 조정
      let intervalMs = 100; // 기본 간격

      if (currentThroughput > this.targetMaxThroughput) {
        // 처리량이 너무 높으면 지연 시간 증가
        intervalMs = 200;
      } else if (currentThroughput < this.targetMinThroughput) {
        // 처리량이 너무 낮으면 지연 시간 감소
        intervalMs = 50;
      }

      // 다음 배치 전송 예약
      setTimeout(() => this.produceMessages(), intervalMs);

      // 로그 출력 (배치마다)
      if (this.messageCount % (this.batchSize * this.batchCount * 5) === 0) {
        console.log(
          `Produced ${this.messageCount} messages in ${elapsedSeconds.toFixed(2)} seconds`,
        );
        console.log(
          `Current throughput: ${currentThroughput.toFixed(2)} messages/second (Target: 10,000-11,000)`,
        );
        // 목표 달성 여부 표시
        if (
          currentThroughput >= this.targetMinThroughput &&
          currentThroughput <= this.targetMaxThroughput
        ) {
          console.log('✅ Target throughput achieved!');
        } else if (currentThroughput > this.targetMaxThroughput) {
          console.log('⚠️ Throughput too high, adjusting...');
        } else {
          console.log('⚠️ Throughput too low, adjusting...');
        }
      }
    } catch (error) {
      console.error('Error producing messages:', error);
      // 오류 발생 시 잠시 대기 후 재시도
      setTimeout(() => this.produceMessages(), 1000);
    }
  }

  private generateMessages(count: number) {
    const messages = [];

    for (let i = 0; i < count; i++) {
      const message: Message = {
        name: `Product-${Math.floor(Math.random() * 1000)}`.substring(0, 19), // 20자 미만
        description: this.generateRandomString(
          100 + Math.floor(Math.random() * 900),
        ), // 100-1000자
        price: Math.floor(Math.random() * 1000000), // 정수 범위
      };

      messages.push({
        key: `key-${i}`,
        value: JSON.stringify(message),
      });
    }

    return messages;
  }

  private generateRandomString(length: number): string {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
    let result = '';

    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }

    return result;
  }
}
