import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SpaceController } from './space.controller';
import { SpaceService } from './space.service';

@Module({
  controllers: [SpaceController],
  providers: [SpaceService, RolesGuard],
  exports: [SpaceService],
})
export class SpaceModule {}
