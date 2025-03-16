import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { KafkaService } from './kafka/kafka.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly kafkaService: KafkaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('start')
  async startProducing() {
    await this.kafkaService.startProducing();
    return { message: 'Started producing messages' };
  }

  @Post('stop')
  async stopProducing() {
    await this.kafkaService.stopProducing();
    return { message: 'Stopped producing messages' };
  }
}
