import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { API_PREFIX, configureApp } from './bootstrap/configure-app';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  configureApp(app);

  const config = app.get(AppConfigService);
  const port = config.get('API_PORT');
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`VYRA API listening on http://localhost:${port}/${API_PREFIX}`);
  if (!config.isProduction) logger.log(`Swagger: http://localhost:${port}/${API_PREFIX}/docs`);
}

void bootstrap();
