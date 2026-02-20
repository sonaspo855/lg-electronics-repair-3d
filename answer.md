### gemini_settings.json 추가 옵션 설정 내용

Gemini CLI의 기능을 보다 효율적으로 제어하기 위해 다음과 같은 유용한 옵션들을 추가했습니다.

1. **보안 설정 (Security)**
   - `environmentVariableRedaction`: true (환경 변수 노출 방지)
   - `disableYoloMode`: false (기본값, 도구 실행 전 확인 절차 유지)

2. **일반 설정 (General)**
   - `vimMode`: false (Vim 키바인딩 사용 여부)

3. **UI 및 시각적 설정 (UI)**
   - `inlineThinkingMode`: true (모델의 생각 과정을 실시간으로 확인)
   - `hideBanner`: false (CLI 시작 배너 표시 여부)
   - `hideTips`: false (도움말 팁 표시 여부)
   - `footer.hideCWD`: false (하단바에 현재 디렉토리 표시 여부)

4. **도구 설정 (Tools)**
   - `allowed`: 자동 승인할 도구 목록 (필요시 추가 가능)
   - `exclude`: 실행을 금지할 도구 목록

5. **실험적 기능 (Experimental)**
   - `jitContext`: true (Just-In-Time 컨텍스트 관리로 효율적인 리소스 사용)

6. **컨텍스트 설정 (Context)**
   - `fileFiltering`: `.gitignore` 및 `.geminiignore` 파일을 존중하도록 명시적 설정 추가

7. **모델 설정 (Model)**
   - `maxSessionTurns`: 50 (한 세션당 최대 대화 횟수 제한 설정)

이 옵션들을 통해 CLI의 동작 방식, 보안 수준, 그리고 시각적인 피드백을 사용자 취향에 맞게 세밀하게 조정할 수 있습니다.
