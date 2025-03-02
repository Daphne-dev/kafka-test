import { Module, OnModuleInit } from '@nestjs/common';
import { PromClientController } from './prom-client.controller';
import { PromClientService } from './prom-client.service';

@Module({
  providers: [PromClientService],
  controllers: [PromClientController],
  exports: [PromClientService],
})
export class PromClientModule implements OnModuleInit {
  constructor(private readonly promClientService: PromClientService) {}

  onModuleInit() {
    this.promClientService.startCollecting();
  }
}
