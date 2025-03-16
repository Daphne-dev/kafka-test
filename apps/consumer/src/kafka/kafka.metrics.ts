import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { Provider } from '@nestjs/common';

export const consumerMetrics: Provider[] = [
  makeCounterProvider({
    name: 'kafka_consumer_messages_total',
    help: 'Total number of messages consumed',
    labelNames: [],
  }),
  makeGaugeProvider({
    name: 'kafka_consumer_throughput',
    help: 'Current throughput in messages per second',
    labelNames: [],
  }),
  makeHistogramProvider({
    name: 'kafka_message_processing_time_seconds',
    help: 'Histogram of message processing time in seconds',
    labelNames: ['operation', 'topic'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1], // 1ms부터 1초까지
  }),
  makeGaugeProvider({
    name: 'kafka_consumer_lag',
    help: 'Lag in number of messages per consumer group',
    labelNames: ['topic', 'groupId', 'partition'],
  }),
];
