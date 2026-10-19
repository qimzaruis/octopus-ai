-- เก็บอายุ log การเรียกใช้ API: เปิด pg_cron แล้วลบแถวที่เก่ากว่า 90 วันทุกวัน
-- (รันแล้วบนฐานข้อมูล production เมื่อ 2026-10-19 — ไฟล์นี้ไว้ให้เครื่องอื่น/อ่านย้อนหลัง)
--
-- pg_cron ทำงานอยู่เฉพาะในฐานข้อมูลที่ติดตั้ง extension (ของ Supabase คือ `postgres`)
-- ถ้าแอปย้ายไปฐานข้อมูลชื่ออื่น ต้องใช้ cron.schedule(jobname, schedule, database, schema, command)

create extension if not exists pg_cron;

select
  cron.unschedule(jobid)
from
  cron.job
where
  jobname = 'prune-requests';

select
  cron.schedule(
    'prune-requests',
    '40 3 * * *',
    $$
    delete from public.requests
    where
      id in (
        select
          id
        from
          public.requests
        where
          created_at < now() - interval '90 days'
        limit
          5000
      );
    $$
  );

-- ตรวจ: select jobname, schedule, active from cron.job;
-- ผลรัน: select status, rows_affected, start_time from cron.job_run_details order by start_time desc limit 5;
