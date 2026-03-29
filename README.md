# 🎨 TilesetMaster

[![Deployment](https://img.shields.io/badge/Live-Demo-brightgreen)](https://godwish.github.io/TilesetMaster/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

🇰🇷 🇺🇸 🇯🇵 🇨🇳 🇹🇼 🇷🇺 🇪🇸 🇫🇷 🇩🇪

> **"원하는 타일만 쏙쏙 골라 담는, 게임 개발자를 위한 가장 쉬운 타일셋 편집기"**  
> **Click here to run:** [https://godwish.github.io/TilesetMaster/](https://godwish.github.io/TilesetMaster/)


---

<img width="1300" height="944" alt="Hero Image" src="https://github.com/user-attachments/assets/881e7f8a-cec9-41dc-9ffc-be67d6bb14b6" />

---

## 🌟 프로젝트 소개 (About TilesetMaster)

게임 개발자가 게임을 만들기 위해 많은 유/무료 에셋을 모으게 되는데, 특히 도트 게임용 타일셋을 찾다 보면 하나의 파일 안에 내가 원하는 타일만 있는 것이 아니라는 것을 알게 됩니다. 

여러 타일셋 파일들에서 내가 정작 필요한 타일들만 골라내어 새로운 타일셋 파일로 합치고 정리하는 과정은 번거롭고 시간이 많이 걸리는 작업입니다. **TilesetMaster**는 이 과정을 극도로 단순화하고 직관적으로 만들기 위해 탄생했습니다.

여러 이미지에서 필요한 부분만 드래그하여 하나의 캔버스로 모으고, 빈 공간에 자동으로 배치하며, 나만의 완벽한 타일셋을 완성해 보세요.


<img width="1293" height="907" alt="About TilesetMaster" src="https://github.com/user-attachments/assets/ca7887ef-b61f-4a0c-b864-d655e119046a" />

---

## ✨ 주요 기능 (Key Features)

- **마우스 기반 워크플로우**: 복잡한 단축키 없이 마우스 클릭과 드래그만으로 모든 편집이 가능합니다.
- **자동 여백 제거 (Auto-Trim)**: 영역을 선택하면 주변의 투명한 여백을 자동으로 계산하여 실제 픽셀 데이터만 깔끔하게 복사합니다.
- **스마트 배치 (Smart Packing)**: 타일 블록을 빈 공간에 우클릭 한 번으로 자동으로 빈틈없이 배치할 수 있습니다.
- **다국어 지원 (i18n)**: 한국어, 영어, 일본어, 중국어 등 총 9개 국어를 지원합니다.
  - 🇰🇷 한국어, 🇺🇸 English, 🇯🇵 日本語, 🇨🇳 简体中文, 🇹🇼 繁體中文, 🇷🇺 Русский, 🇪🇸 Español, 🇫🇷 Français, 🇩🇪 Deutsch
- **강력한 캔버스 제어**: 무한 팬(Panning)과 줌(Zoom), 그리드 스냅 기능을 통해 정교한 작업이 가능합니다.


<img width="1297" height="898" alt="Key Features" src="https://github.com/user-attachments/assets/b2d0d6bd-e49e-448d-b5f8-e5c060a53948" />

---

## 🖱️ 조작 방법 (Controls)

### 마우스 조작
- **영역 드래그**: 타일 영역을 지정합니다. (마우스를 떼면 자동으로 복사됩니다.)
- **선택 영역 클릭**: 지정된 영역을 잘라내어 즉시 이동 모드로 전환합니다.
- **빈 공간 우클릭**: 클립보드에 복사된 내용을 현재 위치에 붙여넣습니다.
- **오브젝트 우클릭**: 현재 들고 있는 타일 블록을 캔버스의 빈 공간에 자동으로 배치합니다.
- **휠 클릭 / Shift + 드래그**: 화면을 자유롭게 이동(Panning)합니다.
- **마우스 휠**: 화면을 확대하거나 축소합니다.

### 주요 단축키
- `Ctrl + C / X / V`: 복사, 잘라내기, 붙여넣기
- `Ctrl + Z / Shift + Z (또는 Ctrl + Y)`: 실행 취소 / 다시 실행
- `Tab`: 그리드(Grid) 켜기 / 끄기
- `Esc / Backspace / Delete`: 현재 선택이나 이동 중인 블록을 취소하거나 삭제합니다.
- `Enter / Space`: 이동 중인 블록을 현재 위치에 고정합니다.


<img width="1303" height="934" alt="Controls" src="https://github.com/user-attachments/assets/cf2abdeb-66ec-41fe-99a4-7dfebfd97c5e" />

---

## 🛠️ 개발 및 설치 (Development & Setup)

로컬 환경에서 개발하거나 빌드하려면 아래 단계를 따르세요.

### Requirements
- Node.js (Latest LTS recommended)
- npm or yarn

### Installation
```bash
# 저장소 클론
git clone https://github.com/godwish/TilesetMaster.git

# 프로젝트 폴더로 이동
cd TilesetMaster

# 의존성 설치
npm install
```

### Development
```bash
npm run dev
```

### Build & Deploy
```bash
# 프로덕션 빌드
npm run build

# GitHub Pages 배포
npm run deploy
```


<img width="1291" height="898" alt="Setup & Features" src="https://github.com/user-attachments/assets/2b7e6a88-7a8c-4f36-9cb9-53633196d343" />

---

## 📄 License
This project is licensed under the Apache License 2.0.
