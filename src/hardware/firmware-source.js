import {runtimeSource} from './runtime-source.js';

export function liveFirmwareSource({camera=false}={}) {
  return '// DUETBlox Live v1. Generated from firmware-source.js + runtime-source.js.\n// USB serial, 115200 baud. Physical validation remains required.\n' + (camera?'#define DUET_CAMERA_BOARD 1\n':'') + runtimeSource() + String.raw`
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
`;
}
