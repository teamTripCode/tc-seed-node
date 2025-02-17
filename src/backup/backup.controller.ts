import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BackupService } from './backup.service';
import { CreateBackupDto } from './dto/create-backup.dto';
import { UpdateBackupDto } from './dto/update-backup.dto';

@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}
  
}
