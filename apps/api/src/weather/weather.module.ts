import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MockWeatherProvider } from './mock-weather.provider';
import { OpenMeteoWeatherProvider } from './open-meteo.provider';
import { WeatherController } from './weather.controller';
import { WeatherProvider } from './weather.provider';
import { WeatherService } from './weather.service';

@Global()
@Module({
  controllers: [WeatherController],
  providers: [
    WeatherService,
    {
      provide: WeatherProvider,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): WeatherProvider => {
        switch (config.get('WEATHER_PROVIDER')) {
          case 'open-meteo':
            return new OpenMeteoWeatherProvider();
          case 'mock':
            return new MockWeatherProvider();
        }
      },
    },
  ],
  exports: [WeatherService, WeatherProvider],
})
export class WeatherModule {}
