import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { producerMetrics } from './kafka.metrics';

@Module({
  providers: [KafkaService, ...producerMetrics],
  exports: [KafkaService],
})
export class KafkaModule {}
