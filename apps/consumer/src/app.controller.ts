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
  async startConsuming() {
    await this.kafkaService.startConsuming();
    return { message: 'Started consuming messages' };
  }

  @Post('stop')
  async stopConsuming() {
    await this.kafkaService.stopConsuming();
    return { message: 'Stopped consuming messages' };
  }

  @Get('stats')
  getStats() {
    return this.kafkaService.getStats();
  }
}
