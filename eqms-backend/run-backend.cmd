@echo off
setlocal
cd /d D:\edms-project\eqms-backend
"C:\Program Files\Java\jdk-23\bin\java.exe" -jar "D:\edms-project\eqms-backend\target\eqms-backend-0.0.1-SNAPSHOT.jar" 1>> "D:\edms-project\eqms-backend\backend-run.out.log" 2>> "D:\edms-project\eqms-backend\backend-run.err.log"
