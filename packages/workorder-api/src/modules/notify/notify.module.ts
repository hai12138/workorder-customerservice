import { Module } from '@nestjs/common';
import { NotifyController } from './notify.controller';
import { NotificationDispatcher, SimulatorChannel } from './notify.service';

@Module({
  controllers: [NotifyController],
  providers: [SimulatorChannel, NotificationDispatcher],
  exports: [NotificationDispatcher, SimulatorChannel],
})
export class NotifyModule {}
