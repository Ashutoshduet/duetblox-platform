import {boardRegistry} from './boards.js';

// Shared source for standalone exports and the checked-in live firmware.
const macro = {UNO:'ARDUINO_AVR_UNO',NANO:'ARDUINO_AVR_NANO',MEGA:'ARDUINO_AVR_MEGA2560',ESP32:'ARDUINO_ESP32_DEV',ESP32CAM:'ARDUINO_ESP32_DEV'};
const testPins = pins => pins.length ? pins.map(p => `pin == ${p}`).join(' || ') : 'false';
export function profileSource(board) {
  return `#define DUET_BOARD_ID "${board.firmwareId}"
#define DUET_PIN_MAX ${Math.max(...board.digitalPins)}
#define DUET_IS_ESP ${board.core === 'esp32:esp32' ? 1 : 0}
#define DUET_ANALOG_MAX ${board.analogMax}
static bool duetDigitalPin(uint8_t pin) { return ${testPins(board.digitalPins)}; }
static bool duetOutputPin(uint8_t pin) { return ${testPins(board.outputPins)}; }
static bool duetPullupPin(uint8_t pin) { return ${testPins(board.pullupPins)}; }
static bool duetPWMPin(uint8_t pin) { return ${testPins(board.pwmPins)}; }
static bool duetAnalogPin(uint8_t pin) { return ${testPins(board.analogPins.map(p => p.startsWith('A') ? Number(p.slice(1)) : Number(p)))}; }
static bool duetServoTimerPin(uint8_t pin) { return ${testPins(board.pwmServoConflict)}; }
static bool duetToneTimerPin(uint8_t pin) { return ${testPins(board.pwmToneConflict)}; }
`;
}
export function allProfilesSource() {
  const boards=boardRegistry.filter(b=>b.live).sort((a,b)=>(a.id==='esp32-cam'?-1:0)-(b.id==='esp32-cam'?-1:0));
  return boards.map((board,index)=>`${index ? '#elif' : '#if'} defined(${macro[board.firmwareId]})${board.id==='esp32-cam'?' && defined(DUET_CAMERA_BOARD)':''}\n${profileSource(board)}`).join('') + '#else\n#error "Select Uno R3, classic Nano, Mega 2560, ESP32 Dev Module (WROOM) or AI Thinker ESP32-CAM."\n#endif\n';
}
export function runtimeSource(board) {
  return '#include <Arduino.h>\n#include <math.h>\n' + (board ? `#if !defined(${macro[board.firmwareId]})\n#error "This sketch was generated for ${board.name}. Select the matching board."\n#endif\n${profileSource(board)}` : allProfilesSource()) + RUNTIME;
}

const RUNTIME = String.raw`
#if DUET_IS_ESP
  #include <esp_arduino_version.h>
  #if ESP_ARDUINO_VERSION_MAJOR < 3
    #error "DUETBlox requires Arduino ESP32 core 3.x."
  #endif
#else
  #include <Servo.h>
  static Servo duetServos[4];
#endif
static int8_t duetServoPins[4] = {-1,-1,-1,-1};
static int8_t duetPWMPins[8] = {-1,-1,-1,-1,-1,-1,-1,-1};
static uint8_t duetPinUse[DUET_PIN_MAX+1] = {0}; // 1=PWM, 2=servo, 3=tone, 4=GPIO
static bool duetServoTimerUsed = false, duetToneTimerUsed = false;
static int8_t duetTonePin = -1;
static unsigned long duetToneStart = 0, duetToneDuration = 0;

static void duetRelease(uint8_t pin) {
  if (!duetOutputPin(pin)) return;
  if (duetPinUse[pin] == 3) {
#if DUET_IS_ESP
    ledcDetach(pin);
#else
    noTone(pin);
#endif
    duetTonePin = -1; duetToneDuration = 0;
  }
  if (duetPinUse[pin] == 2) {
    for (uint8_t i=0;i<4;++i) if (duetServoPins[i] == pin) {
#if DUET_IS_ESP
      ledcDetach(pin);
#else
      duetServos[i].detach();
#endif
      duetServoPins[i] = -1;
    }
  }
  if (duetPinUse[pin] == 1) {
#if DUET_IS_ESP
    ledcDetach(pin);
    for (uint8_t i=0;i<8;++i) if (duetPWMPins[i] == pin) duetPWMPins[i] = -1;
#endif
  }
  digitalWrite(pin, LOW); duetPinUse[pin] = 0;
}
static void duetTick() {
  if (duetTonePin >= 0 && duetToneDuration && (unsigned long)(millis()-duetToneStart) >= duetToneDuration) duetRelease(duetTonePin);
}
static void duetSafeOutputs() {
  for (uint8_t pin=0;pin<=DUET_PIN_MAX;++pin) if (duetPinUse[pin]) {
    duetRelease(pin); pinMode(pin, INPUT); duetPinUse[pin]=0;
  }
  // AVR Servo does not restore the original PWM timer. Keep timer reservations until reset.
}
static bool duetSetPinMode(uint8_t pin, uint8_t mode) {
  if (!duetDigitalPin(pin) || (mode==OUTPUT && !duetOutputPin(pin)) || (mode==INPUT_PULLUP && !duetPullupPin(pin))) return false;
  duetRelease(pin); pinMode(pin,mode); duetPinUse[pin]=4; return true;
}
static bool duetDigitalWrite(uint8_t pin, double n) {
  if (!duetOutputPin(pin) || (n!=0 && n!=1)) return false;
  duetRelease(pin); pinMode(pin,OUTPUT); digitalWrite(pin,n==1?HIGH:LOW); duetPinUse[pin]=4; return true;
}
static bool duetAnalogWrite(uint8_t pin, double n) {
  if (!duetPWMPin(pin) || !isfinite(n) || n<0 || n>255 || floor(n)!=n) return false;
#if DUET_IS_ESP
  if (duetPinUse[pin]!=1) {
    duetRelease(pin); int8_t slot=-1;
    for (uint8_t i=0;i<8;++i) if (duetPWMPins[i]<0) { slot=i; break; }
    if (slot<0 || !ledcAttachChannel(pin,1000,8,slot)) return false;
    duetPWMPins[slot]=pin; duetPinUse[pin]=1;
  }
  return ledcWrite(pin,(uint32_t)n);
#else
  if ((duetServoTimerUsed && duetServoTimerPin(pin)) || (duetToneTimerUsed && duetToneTimerPin(pin))) return false;
  duetRelease(pin); pinMode(pin,OUTPUT); analogWrite(pin,(int)n); duetPinUse[pin]=1; return true;
#endif
}
static bool duetServoWrite(uint8_t pin, double angle) {
  if (!duetOutputPin(pin) || !isfinite(angle) || angle<0 || angle>180 || floor(angle)!=angle) return false;
#if !DUET_IS_ESP
  for (uint8_t p=0;p<=DUET_PIN_MAX;++p) if (duetPinUse[p]==1 && duetServoTimerPin(p)) return false;
#endif
  int8_t slot=-1;
  for (uint8_t i=0;i<4;++i) if (duetServoPins[i]==pin) { slot=i; break; }
  if (slot<0) {
    for (uint8_t i=0;i<4;++i) if (duetServoPins[i]<0) { slot=i; break; }
    if (slot<0) return false;
    duetRelease(pin);
#if DUET_IS_ESP
    // Dedicated low-speed timer bank: servo channels 8..11; tone uses channel 14.
    if (!ledcAttachChannel(pin,50,16,8+slot)) return false;
#else
    if (duetServos[slot].attach(pin,1000,2000)==INVALID_SERVO) return false;
    duetServoTimerUsed=true;
#endif
    duetServoPins[slot]=pin; duetPinUse[pin]=2;
  }
#if DUET_IS_ESP
  return ledcWrite(pin,(uint32_t)(((1000.0+angle*1000.0/180.0)/20000.0)*65535.0+0.5));
#else
  duetServos[slot].write((int)angle); return true;
#endif
}
static void duetServoDetach(uint8_t pin) { if (duetOutputPin(pin) && duetPinUse[pin]==2) duetRelease(pin); }
static bool duetTone(uint8_t pin, double hz, double seconds) {
  if (!duetOutputPin(pin) || !isfinite(hz) || floor(hz)!=hz || hz<31 || hz>20000 || !isfinite(seconds) || seconds<0 || seconds>3600) return false;
#if !DUET_IS_ESP
  for (uint8_t p=0;p<=DUET_PIN_MAX;++p) if (duetPinUse[p]==1 && duetToneTimerPin(p)) return false;
#endif
  if (duetTonePin>=0) duetRelease(duetTonePin);
  duetRelease(pin);
#if DUET_IS_ESP
  if (!ledcAttachChannel(pin,(uint32_t)hz,10,14)) return false;
  if (!ledcWrite(pin,512)) { ledcDetach(pin); return false; }
#else
  tone(pin,(unsigned int)hz); duetToneTimerUsed=true;
#endif
  duetPinUse[pin]=3; duetTonePin=pin; duetToneStart=millis(); duetToneDuration=seconds>0?(unsigned long)fmax(1,seconds*1000.0+0.5):0; return true;
}
static void duetNoTone(uint8_t pin) { if (duetOutputPin(pin) && duetPinUse[pin]==3) duetRelease(pin); }
static double duetDivide(double a,double b) { return a/b; }
static double duetMod(double a,double b) { double r=fmod(a,b); return r!=0 && ((r<0)!=(b<0)) ? r+b : r; }
static double duetMap(double n,double a,double b,double c,double d) { return b==a ? 0 : (n-a)*(d-c)/(b-a)+c; }
static double duetRandom(double a,double b) {
  if (!isfinite(a)||!isfinite(b)) return 0;
  if (a>b) { double swap=a;a=b;b=swap; }
  double fraction=(double)random(0,16777216L)/16777216.0;
  return floor(a)==a && floor(b)==b ? fmin(b,a+floor(fraction*(b-a+1))) : a+fraction*(b-a);
}
static unsigned long duetRepeat(double n) { return !isfinite(n)||n<=0 ? 0 : (unsigned long)fmin(floor(n+0.5),4294967040.0); }
static void duetYield() { duetTick(); delay(1); }
static void duetWait(double seconds) {
  if (!isfinite(seconds)||seconds<=0) return;
  double ms=seconds*1000.0;
  while (ms>=10) { duetTick(); delay(10); ms-=10; }
  if(ms>0) delay((unsigned long)ms);
  duetTick();
}
static void duetBegin() {
#if DUET_IS_ESP
  analogReadResolution(12);
#endif
  // Deliberately deterministic across resets; this random block is not cryptographic.
  randomSeed(1);
}
`;
