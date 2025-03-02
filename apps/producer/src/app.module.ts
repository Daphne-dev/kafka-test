import { Module } from '@nestjs/common';
import { PromClientModule } from '@repo/prometheus';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [PromClientModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
