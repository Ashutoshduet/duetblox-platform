// DUETBlox Live v1. Generated from firmware-source.js + runtime-source.js.
// USB serial, 115200 baud. Physical validation remains required.
#include <Arduino.h>
#include <math.h>
#if defined(ARDUINO_ESP32_DEV) && defined(DUET_CAMERA_BOARD)
#define DUET_BOARD_ID "ESP32CAM"
#define DUET_PIN_MAX 14
#define DUET_IS_ESP 1
#define DUET_ANALOG_MAX 4095
static bool duetDigitalPin(uint8_t pin) { return pin == 4 || pin == 13 || pin == 14; }
static bool duetOutputPin(uint8_t pin) { return pin == 4 || pin == 13 || pin == 14; }
static bool duetPullupPin(uint8_t pin) { return pin == 4 || pin == 13 || pin == 14; }
static bool duetPWMPin(uint8_t pin) { return pin == 4 || pin == 13 || pin == 14; }
static bool duetAnalogPin(uint8_t pin) { return false; }
static bool duetServoTimerPin(uint8_t pin) { return false; }
static bool duetToneTimerPin(uint8_t pin) { return false; }
#elif defined(ARDUINO_AVR_UNO)
#define DUET_BOARD_ID "UNO"
#define DUET_PIN_MAX 13
#define DUET_IS_ESP 0
#define DUET_ANALOG_MAX 1023
static bool duetDigitalPin(uint8_t pin) { return pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7 || pin == 8 || pin == 9 || pin == 10 || pin == 11 || pin == 12 || pin == 13; }
static bool duetOutputPin(uint8_t pin) { return pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7 || pin == 8 || pin == 9 || pin == 10 || pin == 11 || pin == 12 || pin == 13; }
static bool duetPullupPin(uint8_t pin) { return pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7 || pin == 8 || pin == 9 || pin == 10 || pin == 11 || pin == 12 || pin == 13; }
static bool duetPWMPin(uint8_t pin) { return pin == 3 || pin == 5 || pin == 6 || pin == 9 || pin == 10 || pin == 11; }
static bool duetAnalogPin(uint8_t pin) { return pin == 0 || pin == 1 || pin == 2 || pin == 3 || pin == 4 || pin == 5; }
static bool duetServoTimerPin(uint8_t pin) { return pin == 9 || pin == 10; }
static bool duetToneTimerPin(uint8_t pin) { return pin == 3 || pin == 11; }
#elif defined(ARDUINO_AVR_MEGA2560)
#define DUET_BOARD_ID "MEGA"
#define DUET_PIN_MAX 53
#define DUET_IS_ESP 0
#define DUET_ANALOG_MAX 1023
static bool duetDigitalPin(uint8_t pin) { return pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7 || pin == 8 || pin == 9 || pin == 10 || pin == 11 || pin == 12 || pin == 13 || pin == 14 || pin == 15 || pin == 16 || pin == 17 || pin == 18 || pin == 19 || pin == 20 || pin == 21 || pin == 22 || pin == 23 || pin == 24 || pin == 25 || pin == 26 || pin == 27 || pin == 28 || pin == 29 || pin == 30 || pin == 31 || pin == 32 || pin == 33 || pin == 34 || pin == 35 || pin == 36 || pin == 37 || pin == 38 || pin == 39 || pin == 40 || pin == 41 || pin == 42 || pin == 43 || pin == 44 || pin == 45 || pin == 46 || pin == 47 || pin == 48 || pin == 49 || pin == 50 || pin == 51 || pin == 52 || pin == 53; }
static bool duetOutputPin(uint8_t pin) { return pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7 || pin == 8 || pin == 9 || pin == 10 || pin == 11 || pin == 12 || pin == 13 || pin == 14 || pin == 15 || pin == 16 || pin == 17 || pin == 18 || pin == 19 || pin == 20 || pin == 21 || pin == 22 || pin == 23 || pin == 24 || pin == 25 || pin == 26 || pin == 27 || pin == 28 || pin == 29 || pin == 30 || pin == 31 || pin == 32 || pin == 33 || pin == 34 || pin == 35 || pin == 36 || pin == 37 || pin == 38 || pin == 39 || pin == 40 || pin == 41 || pin == 42 || pin == 43 || pin == 44 || pin == 45 || pin == 46 || pin == 47 || pin == 48 || pin == 49 || pin == 50 || pin == 51 || pin == 52 || pin == 53; }
static bool duetPullupPin(uint8_t pin) { return pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7 || pin == 8 || pin == 9 || pin == 10 || pin == 11 || pin == 12 || pin == 13 || pin == 14 || pin == 15 || pin == 16 || pin == 17 || pin == 18 || pin == 19 || pin == 20 || pin == 21 || pin == 22 || pin == 23 || pin == 24 || pin == 25 || pin == 26 || pin == 27 || pin == 28 || pin == 29 || pin == 30 || pin == 31 || pin == 32 || pin == 33 || pin == 34 || pin == 35 || pin == 36 || pin == 37 || pin == 38 || pin == 39 || pin == 40 || pin == 41 || pin == 42 || pin == 43 || pin == 44 || pin == 45 || pin == 46 || pin == 47 || pin == 48 || pin == 49 || pin == 50 || pin == 51 || pin == 52 || pin == 53; }
static bool duetPWMPin(uint8_t pin) { return pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7 || pin == 8 || pin == 9 || pin == 10 || pin == 11 || pin == 12 || pin == 13 || pin == 44 || pin == 45 || pin == 46; }
static bool duetAnalogPin(uint8_t pin) { return pin == 0 || pin == 1 || pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7 || pin == 8 || pin == 9 || pin == 10 || pin == 11 || pin == 12 || pin == 13 || pin == 14 || pin == 15; }
static bool duetServoTimerPin(uint8_t pin) { return pin == 44 || pin == 45 || pin == 46; }
static bool duetToneTimerPin(uint8_t pin) { return pin == 9 || pin == 10; }
#elif defined(ARDUINO_AVR_NANO)
#define DUET_BOARD_ID "NANO"
#define DUET_PIN_MAX 13
#define DUET_IS_ESP 0
#define DUET_ANALOG_MAX 1023
static bool duetDigitalPin(uint8_t pin) { return pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7 || pin == 8 || pin == 9 || pin == 10 || pin == 11 || pin == 12 || pin == 13; }
static bool duetOutputPin(uint8_t pin) { return pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7 || pin == 8 || pin == 9 || pin == 10 || pin == 11 || pin == 12 || pin == 13; }
static bool duetPullupPin(uint8_t pin) { return pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7 || pin == 8 || pin == 9 || pin == 10 || pin == 11 || pin == 12 || pin == 13; }
static bool duetPWMPin(uint8_t pin) { return pin == 3 || pin == 5 || pin == 6 || pin == 9 || pin == 10 || pin == 11; }
static bool duetAnalogPin(uint8_t pin) { return pin == 0 || pin == 1 || pin == 2 || pin == 3 || pin == 4 || pin == 5 || pin == 6 || pin == 7; }
static bool duetServoTimerPin(uint8_t pin) { return pin == 9 || pin == 10; }
static bool duetToneTimerPin(uint8_t pin) { return pin == 3 || pin == 11; }
#elif defined(ARDUINO_ESP32_DEV)
#define DUET_BOARD_ID "ESP32"
#define DUET_PIN_MAX 39
#define DUET_IS_ESP 1
#define DUET_ANALOG_MAX 4095
static bool duetDigitalPin(uint8_t pin) { return pin == 4 || pin == 13 || pin == 14 || pin == 16 || pin == 17 || pin == 18 || pin == 19 || pin == 21 || pin == 22 || pin == 23 || pin == 25 || pin == 26 || pin == 27 || pin == 32 || pin == 33 || pin == 34 || pin == 35 || pin == 36 || pin == 39; }
static bool duetOutputPin(uint8_t pin) { return pin == 4 || pin == 13 || pin == 14 || pin == 16 || pin == 17 || pin == 18 || pin == 19 || pin == 21 || pin == 22 || pin == 23 || pin == 25 || pin == 26 || pin == 27 || pin == 32 || pin == 33; }
static bool duetPullupPin(uint8_t pin) { return pin == 4 || pin == 13 || pin == 14 || pin == 16 || pin == 17 || pin == 18 || pin == 19 || pin == 21 || pin == 22 || pin == 23 || pin == 25 || pin == 26 || pin == 27 || pin == 32 || pin == 33; }
static bool duetPWMPin(uint8_t pin) { return pin == 4 || pin == 13 || pin == 14 || pin == 16 || pin == 17 || pin == 18 || pin == 19 || pin == 21 || pin == 22 || pin == 23 || pin == 25 || pin == 26 || pin == 27 || pin == 32 || pin == 33; }
static bool duetAnalogPin(uint8_t pin) { return pin == 32 || pin == 33 || pin == 34 || pin == 35 || pin == 36 || pin == 39; }
static bool duetServoTimerPin(uint8_t pin) { return false; }
static bool duetToneTimerPin(uint8_t pin) { return false; }
#else
#error "Select Uno R3, classic Nano, Mega 2560, ESP32 Dev Module (WROOM) or AI Thinker ESP32-CAM."
#endif

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

#include <stdlib.h>
#include <string.h>
static char lineBuffer[96];
static uint8_t lineLength=0;
static bool discardLine=false, sessionActive=false;
static unsigned long lastCommand=0;
static const unsigned long WATCHDOG_MS=4000;

static bool number(const char *text,long minimum,long maximum,long &out) {
  if (!text || !*text || strlen(text)>10) return false;
  for (const char *p=text;*p;++p) if (*p<'0'||*p>'9') return false;
  // Bounds checked during accumulation, before overflow on 32-bit AVR long.
  unsigned long value=0;
  for (const char *p=text;*p;++p) {
    unsigned long digit=(unsigned long)(*p-'0');
    if (digit>(unsigned long)maximum || value>((unsigned long)maximum-digit)/10) return false;
    value=value*10+digit;
  }
  out=(long)value; return out>=minimum && out<=maximum;
}
static void response(long id,bool ok,const char *message) {
  Serial.print(id); Serial.print(ok?F(" OK"):F(" ERR"));
  if (message && *message) { Serial.print(' '); Serial.print(message); }
  Serial.println();
}
static void valueResponse(long id,int value) { Serial.print(id);Serial.print(F(" OK "));Serial.println(value); }
static void processLine() {
  char *save; char *tokens[6]; uint8_t count=0;
  char *part=strtok_r(lineBuffer," ",&save);
  while(part && count<6) { tokens[count++]=part;part=strtok_r(NULL," ",&save); }
  long id,pin,value,duration;
  if(count<2 || !number(tokens[0],1,65535,id)) return;
  if(count>5 || part) { response(id,false,"ARGUMENTS");return; }
  const char *command=tokens[1];
  if(!strcmp(command,"HELLO") && count==2) {
    duetSafeOutputs();sessionActive=true;lastCommand=millis();response(id,true,"DUETBLOX 1 " DUET_BOARD_ID);return;
  }
  if(!sessionActive) { response(id,false,"HANDSHAKE_REQUIRED");return; }
  if(!strcmp(command,"PING") && count==2) { lastCommand=millis();response(id,true,"");return; }
  if(!strcmp(command,"STOP") && count==2) { duetSafeOutputs();lastCommand=millis();response(id,true,"");return; }
  if(!strcmp(command,"ANALOG") && count==3) {
    if(!number(tokens[2],0,255,pin)||!duetAnalogPin(pin)) { response(id,false,"ANALOG_PIN");return; }
    lastCommand=millis();valueResponse(id,analogRead((uint8_t)pin));return;
  }
  if(count<3 || !number(tokens[2],0,DUET_PIN_MAX,pin) || !duetDigitalPin(pin)) { response(id,false,"PIN");return; }
  bool ok=false;
  if(!strcmp(command,"MODE") && count==4) {
    uint8_t mode;
    if(!strcmp(tokens[3],"INPUT")) mode=INPUT;
    else if(!strcmp(tokens[3],"INPUT_PULLUP")) mode=INPUT_PULLUP;
    else if(!strcmp(tokens[3],"OUTPUT")) mode=OUTPUT;
    else { response(id,false,"MODE");return; }
    ok=duetSetPinMode(pin,mode);
  } else if(!strcmp(command,"WRITE") && count==4) {
    ok=number(tokens[3],0,1,value) && duetDigitalWrite(pin,value);
  } else if(!strcmp(command,"PWM") && count==4) {
    ok=number(tokens[3],0,255,value) && duetAnalogWrite(pin,value);
  } else if(!strcmp(command,"SERVO") && count==4) {
    ok=number(tokens[3],0,180,value) && duetServoWrite(pin,value);
  } else if(!strcmp(command,"DETACH") && count==3 && duetOutputPin(pin)) {
    duetServoDetach(pin);ok=true;
  } else if(!strcmp(command,"TONE") && count==5) {
    ok=number(tokens[3],31,20000,value) && number(tokens[4],0,3600000,duration) && duetTone(pin,value,duration/1000.0);
  } else if(!strcmp(command,"NOTONE") && count==3 && duetOutputPin(pin)) {
    duetNoTone(pin);ok=true;
  } else if(!strcmp(command,"READ") && count==3) {
    lastCommand=millis();valueResponse(id,digitalRead(pin));return;
  } else { response(id,false,"COMMAND");return; }
  if(ok) lastCommand=millis();
  response(id,ok,ok?"":"PIN_VALUE_OR_TIMER_RESOURCE");
}
void setup() { Serial.begin(115200);duetBegin(); }
void loop() {
  duetTick();
  // Bounded work per iteration, so input flooding cannot starve the watchdog.
  uint8_t budget=96;
  while(Serial.available() && budget--) {
    int c=Serial.read();
    if(c=='\n') {
      if(!discardLine && lineLength) { lineBuffer[lineLength]='\0';processLine(); }
      lineLength=0;discardLine=false;
    } else if(c!='\r') {
      if(c<32 || c>126 || lineLength>=sizeof(lineBuffer)-1) { discardLine=true;lineLength=0; }
      else if(!discardLine) lineBuffer[lineLength++]=(char)c;
    }
  }
  if(sessionActive && (unsigned long)(millis()-lastCommand)>WATCHDOG_MS) {
    duetSafeOutputs();sessionActive=false;Serial.println(F("0 EVENT SAFE"));
  }
}
