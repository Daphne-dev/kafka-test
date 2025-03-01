# 앱 구조
## 시작
### command
```bash
docker compose up -d
```
### endpoints
1. app: 3001
2. kafka - broker: 9000
3. grafana: 3002

# 미션
## kafka JS를 이용해서 초당 1만개 produce / consume에 성공하기
### 측정 방법
- grafana dashboard의 초당 처리량 확인
    - 사진으로 인증
### 제한 사항
- redis는 3대까지 띄워도 됨
- docker desktop 설정은 메모리 16GB까지 허용
- kafka 설정, 대수는 제한 없음
- 아키텍처, 앱 개수는 상관 없음
- grafana 대시보드는 상관 없음
