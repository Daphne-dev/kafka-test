import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class KafkaMetricsService {
  // 프로듀서 메트릭
  private readonly messagesSentCounter = new client.Counter({
    name: 'kafka_producer_messages_sent_total',
    help: 'Total number of messages sent by the producer',
    labelNames: ['topic'],
  });

  private readonly messagesSentBytesCounter = new client.Counter({
    name: 'kafka_producer_messages_sent_bytes_total',
    help: 'Total bytes of messages sent by the producer',
    labelNames: ['topic'],
  });

  private readonly producerThroughputGauge = new client.Gauge({
    name: 'kafka_producer_throughput_messages_per_second',
    help: 'Current throughput in messages per second',
    labelNames: ['topic'],
  });

  // 컨슈머 메트릭
  private readonly messagesConsumedCounter = new client.Counter({
    name: 'kafka_consumer_messages_consumed_total',
    help: 'Total number of messages consumed',
    labelNames: ['topic', 'groupId'],
  });

  private readonly messagesConsumedBytesCounter = new client.Counter({
    name: 'kafka_consumer_messages_consumed_bytes_total',
    help: 'Total bytes of messages consumed',
    labelNames: ['topic', 'groupId'],
  });

  private readonly consumerThroughputGauge = new client.Gauge({
    name: 'kafka_consumer_throughput_messages_per_second',
    help: 'Current throughput in messages per second',
    labelNames: ['topic', 'groupId'],
  });

  private readonly consumerLagGauge = new client.Gauge({
    name: 'kafka_consumer_lag',
    help: 'Lag in number of messages per consumer group',
    labelNames: ['topic', 'groupId', 'partition'],
  });

  private readonly messageProcessingTimeHistogram = new client.Histogram({
    name: 'kafka_message_processing_time_seconds',
    help: 'Histogram of message processing time in seconds',
    labelNames: ['operation', 'topic'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1], // 1ms부터 1초까지
  });

  // 사용 메서드
  observeProducerProcessingTime(topic: string, timeInSeconds: number): void {
    this.messageProcessingTimeHistogram.observe(
      { operation: 'produce', topic },
      timeInSeconds,
    );
  }

  observeConsumerProcessingTime(topic: string, timeInSeconds: number): void {
    this.messageProcessingTimeHistogram.observe(
      { operation: 'consume', topic },
      timeInSeconds,
    );
  }
  // 프로듀서 메트릭 메서드
  incrementMessagesSent(topic: string, count: number = 1): void {
    this.messagesSentCounter.inc({ topic }, count);
  }

  incrementMessagesSentBytes(topic: string, bytes: number): void {
    this.messagesSentBytesCounter.inc({ topic }, bytes);
  }

  setProducerThroughput(topic: string, messagesPerSecond: number): void {
    this.producerThroughputGauge.set({ topic }, messagesPerSecond);
  }

  // 컨슈머 메트릭 메서드
  incrementMessagesConsumed(
    topic: string,
    groupId: string,
    count: number = 1,
  ): void {
    this.messagesConsumedCounter.inc({ topic, groupId }, count);
  }

  incrementMessagesConsumedBytes(
    topic: string,
    groupId: string,
    bytes: number,
  ): void {
    this.messagesConsumedBytesCounter.inc({ topic, groupId }, bytes);
  }

  setConsumerThroughput(
    topic: string,
    groupId: string,
    messagesPerSecond: number,
  ): void {
    this.consumerThroughputGauge.set({ topic, groupId }, messagesPerSecond);
  }

  setConsumerLag(
    topic: string,
    groupId: string,
    partition: number,
    lag: number,
  ): void {
    this.consumerLagGauge.set(
      { topic, groupId, partition: partition.toString() },
      lag,
    );
  }
}
