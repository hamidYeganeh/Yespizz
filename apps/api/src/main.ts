import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  if (process.env.VERCEL) {
    await app.listen(process.env.PORT ?? 3000);
    return;
  }
  await app.listen(process.env.PORT ?? 7038, process.env.HOST ?? '127.0.0.1');
}
void bootstrap();
