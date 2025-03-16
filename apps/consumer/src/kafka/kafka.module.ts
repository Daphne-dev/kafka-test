import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { consumerMetrics } from './kafka.metrics';

@Module({
  providers: [KafkaService, ...consumerMetrics],
  exports: [KafkaService],
})
export class KafkaModule {}
