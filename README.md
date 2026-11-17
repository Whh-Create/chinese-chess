# 中国象棋 · 双人对战

两个人共用一台设备轮流走棋的中国象棋。核心是一个纯前端网页（原生 HTML / CSS / JavaScript，零依赖、零构建），外面套了 **PWA** 和 **Android APK 壳**，网页、手机桌面、安卓应用三种方式都能玩。

## 三种玩法

| 方式 | 怎么用 | 适合 |
| --- | --- | --- |
| 网页 | 直接打开 `index.html`，或访问部署好的网址 | 电脑、任意浏览器 |
| PWA | 手机浏览器打开网址 →「添加到主屏幕」 | 手机，全屏无地址栏，可离线 |
| APK | 安装 `chinese-chess.apk`（仓库里已附一个现成的包） | 安卓手机，独立应用图标 |

> 目录里的 `chinese-chess.apk` 是已经编译好、可以直接安装的成品（792 KB，debug 签名）。改过网页代码后想重新出包，见下方「生成 APK」。

## 功能

- **完整走法规则**：车、马、炮、兵/卒、仕/士、相/象、帅/将的全部合法走法，含蹩马腿、塞象眼、炮翻山、过河兵横走
- **合法性校验**：不能送将、不能自杀，帅将不能在同一直线上直接照面（白脸将）
- **将军提示**：被将军时状态栏告警，将/帅棋子红光闪烁；自动判定**绝杀**与**困毙**
- **落点提示**：点选棋子后，所有可落子位置以绿点/红圈标出，上一步的起点终点也有标记
- **中文棋谱**：自动记录「炮二平五」「马8进7」这类标准记法，同列重复子自动加「前/后」
- **悔棋**：可连续悔棋，Ctrl + Z 快捷；**重开**一键复位
- **音效**：Web Audio 实时合成落子、吃子、将军三种音效，可关闭
- **自适应**：桌面端棋盘与侧栏并排，手机端自动改为上下布局

## 目录结构

```
index.html                  页面
style.css                   样式
script.js                   全部逻辑（棋盘绘制、走法规则、交互）
manifest.webmanifest        PWA 配置
sw.js                       PWA 离线缓存
icons/                      PWA 图标（192 / 512 / maskable）
README.md
.gitignore
.github/workflows/
  build-apk.yml             推代码自动编译 APK
android/                    Android 工程（WebView 壳）
  settings.gradle
  build.gradle
  gradle.properties
  app/
    build.gradle            构建前自动把根目录的网页文件同步进 assets
    src/main/
      AndroidManifest.xml
      java/com/example/chinesechess/MainActivity.java
      res/                  图标、主题、文案
```

> 网页资源只有根目录这一份，Android 构建时由 Gradle 任务 `syncWebAssets` 自动复制到 `assets/www`，改网页不用改两处。

## 本地运行

直接双击 `index.html` 即可。要用 PWA（离线缓存）必须走 http：

```bash
python -m http.server 8000
# 打开 http://localhost:8000
```

## 部署到 GitHub Pages

1. 新建仓库，把整个目录推上去（`.github`、`android` 也要一起推）
2. 仓库 **Settings → Pages** → Source 选 `Deploy from a branch`，分支 `main`、目录 `/ (root)`
3. 访问 `https://<用户名>.github.io/<仓库名>/`

手机上打开这个网址 → 浏览器菜单里「添加到主屏幕」，就和 App 一样了。

## 生成 APK

### 方式一：让 GitHub 帮你编（推荐，不用装任何环境）

仓库已经配好 workflow，推上去就会自动编译：

1. 推代码到 `main` 分支
2. 打开仓库的 **Actions** 标签 → 左侧 **Build APK** → 点进最新一次运行
3. 页面底部 **Artifacts** 里下载 `chinese-chess-apk.zip`，解压得到 `chinese-chess.apk`

首次构建大约 2~4 分钟。之后每次改网页重新推，都会自动出新包。

想要一个可以直接发链接给别人下载的版本，打个 tag 就行：

```bash
git tag v1.0
git push origin v1.0
```

workflow 会自动创建 Release 并把 APK 挂在里面，链接形如
`https://github.com/<用户名>/<仓库名>/releases/download/v1.0/chinese-chess.apk`

### 方式二：本地用 Android Studio 编

1. Android Studio 打开 `android/` 目录（不是仓库根目录）
2. 等 Gradle 同步完成，菜单 **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. 产物在 `android/app/build/outputs/apk/debug/app-debug.apk`

命令行也行（需 JDK 17 + Android SDK）：

```bash
cd android
gradle assembleDebug
```

### 安装到手机

把 `chinese-chess.apk` 传到手机（微信文件传输助手 / 数据线 / 网盘都行），点击安装。首次安装会提示「未知来源应用」，在设置里允许一次即可。

> 这个包用 debug 签名，自己装没问题，但不能直接上架应用商店。要发布到商店需自行生成正式 keystore 并在 `app/build.gradle` 的 `signingConfigs` 里配置。

## 操作

| 操作 | 说明 |
| --- | --- |
| 点击棋子 | 选中并显示可走位置 |
| 点击绿点 / 红圈 | 落子 |
| 点击其他己方棋子 | 改选 |
| 点击空白处 / Esc | 取消选择 |
| 悔棋 | 撤销上一手（可连续） |
| Ctrl + Z | 悔棋快捷键 |
| 安卓返回键 | 连按两次退出（防误触） |

红方在下、黑方在上，红先黑后。

## 规则实现说明

坐标以 `[行, 列]` 表示，`row 0` 为黑方底线，`row 9` 为红方底线，`col 0~8` 从左到右。

- `pseudoMoves()` 生成棋子本身的走法（不检查是否送将）
- `isInCheck()` 反查：遍历对方所有棋子的走法，看能否吃到本方将/帅；「飞将」也在这里统一处理
- `legalMoves()` 对每个候选着法试走一遍，过滤掉走完后自己被将军的着法
- `hasAnyLegalMove()` 走完一方后调用，若对方无任何合法着法，则判**绝杀**（被将军）或**困毙**（未被将军但动不了）

按要求未实现长将判负、六十回合自然限着等冷门规则——双人面对面下棋用不上。

## 浏览器 / 系统要求

Chrome、Edge、Firefox、Safari 现代版本；Android 8.0（API 26）及以上。
