import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  // Exported so the global SessionAuthGuard (provided in AppModule) can use it.
  exports: [AuthService],
})
export class AuthModule {}
