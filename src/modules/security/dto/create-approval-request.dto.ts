import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

// Defines and validates the input required to create an approval request.
export class CreateApprovalRequestDto {
  // Identifies the MCP client requesting permission.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  clientId!: string;

  // Names the protected action that needs user approval.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  action!: string;

  // Explains why the protected action is being requested.
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  // Optional request lifetime in milliseconds; defaults to five minutes in the service.
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive({ message: 'ttlMs must be a positive number' })
  ttlMs?: number;
}
