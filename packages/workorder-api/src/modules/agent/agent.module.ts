import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentRuntimeService } from './agent-runtime.service';

@Module({
  controllers: [AgentController],
  providers: [AgentRuntimeService],
  exports: [AgentRuntimeService],
})
export class AgentModule {}
