from lib24 import *
import lib31
b = Browser()
aid = sql("select id from training_activities where status='CANCELLED' order by updated_at desc limit 1")[0][0]
b.shot('admin', f'/training-management/activities/{aid}', 'T16-01', 'Cancelled_activity_stepper', 'T16: activity đã huỷ: thanh trạng thái', tall=False)
lib31.finish('T16', b)
