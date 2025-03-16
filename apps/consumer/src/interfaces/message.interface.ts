export interface Message {
  name: string; // 20자 미만 string
  description: string; // 100자 이상, 1000자 미만의 string
  price: number; // integer 범위의 숫자
}
