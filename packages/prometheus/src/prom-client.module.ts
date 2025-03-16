import { Module, OnModuleInit } from '@nestjs/common';
import { PromClientController } from './prom-client.controller';
import { PromClientService } from './prom-client.service';
import { KafkaMetricsService } from './kafka-metrics.service';

@Module({
  providers: [PromClientService, KafkaMetricsService],
  controllers: [PromClientController],
  exports: [PromClientService, KafkaMetricsService],
})
export class PromClientModule implements OnModuleInit {
  constructor(private readonly promClientService: PromClientService) {}

  onModuleInit() {
    this.promClientService.startCollecting();
  }
}
