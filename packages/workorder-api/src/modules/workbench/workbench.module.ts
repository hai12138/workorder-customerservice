import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotifyModule } from '../notify/notify.module';
import { PeopleModule } from '../people/people.module';
import { WorkbenchController } from './workbench.controller';
import { WorkbenchService } from './workbench.service';

@Module({
  imports: [NotifyModule, PeopleModule],
  controllers: [WorkbenchController],
  providers: [WorkbenchService, RolesGuard],
  exports: [WorkbenchService],
})
export class WorkbenchModule {}
