import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';

async function bootstrap() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const { AppModule, ObserveInstrument } = await import('./app.module.js');
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
