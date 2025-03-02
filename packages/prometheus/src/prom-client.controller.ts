import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PromClientService } from './prom-client.service';

@Controller('metrics')
export class PromClientController {
  constructor(private readonly promClientService: PromClientService) {}

  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.promClientService.getMetrics();
    res.setHeader('Content-Type', 'text/plain');
    res.send(metrics);
  }
}
