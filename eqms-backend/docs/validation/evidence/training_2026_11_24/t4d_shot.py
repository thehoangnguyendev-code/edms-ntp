"""T4-D: only the shot of the trainer's notice (the bell), as the trainer of the last T4-D activity sees it."""
from lib24 import *
import lib31
b = Browser()
A = 'uat31.s2.qa.pass'


def open_bell(pg):
    pg.mouse.click(1454, 28)
    pg.wait_for_timeout(2500)


b.shot(A, '/training-management/activities', 'T4D-02', 'Trainer_notice', 'T4-D: thông báo trong app của giảng viên: buổi bị huỷ (chuông thông báo)', action=open_bell, tall=False)
lib31.finish('T4D_shot', b)
