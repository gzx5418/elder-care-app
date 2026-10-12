"""生成与网页 SVG 一致的安卓启动图标；纯矢量几何绘制，不需要外部图片。"""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[1] / 'android/app/src/main/res'
SCALE = 4

def make(size, foreground=False, round_icon=False):
    s = size*SCALE
    img = Image.new('RGBA',(s,s),(0,0,0,0))
    draw = ImageDraw.Draw(img)
    if not foreground and not round_icon:
        draw.rounded_rectangle((0,0,s-1,s-1),radius=round(s*0.23),fill='#e8742a')
    if round_icon:
        img = Image.new('RGBA',(s,s),(0,0,0,0));draw=ImageDraw.Draw(img)
        draw.ellipse((0,0,s-1,s-1),fill='#e8742a')
    unit = s/128 * (0.65 if foreground else 0.83)
    offset = (s-128*unit)/2
    def p(x,y): return (round(offset+x*unit),round(offset+y*unit))
    # 两个圆瓣和底部三角形成爱心，中心为心电波。
    draw.ellipse((*p(27,29),*p(67,69)), fill='#fff9f2')
    draw.ellipse((*p(61,29),*p(101,69)), fill='#fff9f2')
    draw.polygon([p(29,57),p(99,57),p(64,96)],fill='#fff9f2')
    points=[p(43,60),p(55,60),p(63,44),p(72,78),p(80,60),p(89,60)]
    draw.line(points,fill='#e8742a',width=max(1,round(5*unit)),joint='curve')
    return img.resize((size,size),Image.Resampling.LANCZOS)

for density,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    folder=ROOT/f'mipmap-{density}';folder.mkdir(parents=True,exist_ok=True)
    make(size).save(folder/'ic_launcher.png')
    make(size,round_icon=True).save(folder/'ic_launcher_round.png')
    make(round(size*108/48),foreground=True).save(folder/'ic_launcher_foreground.png')
print('五种密度启动图标已生成')
