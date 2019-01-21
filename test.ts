/**
 * Motor tests
 */

makerbit.runMotor(Motor.A, 80);
makerbit.stopMotor(Motor.A);

makerbit.runMotor(Motor.B, -50);
makerbit.stopMotor(Motor.B);

makerbit.runMotor(Motor.All, 80);
makerbit.stopMotor(Motor.All);

makerbit.setMotorRotation(Motor.A, MotorRotation.Clockwise);
makerbit.setMotorRotation(Motor.B, MotorRotation.CounterClockwise);
