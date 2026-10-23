/** Arduino Mega's wiring bootloader differs from a generic STK500v2 ISP.
 * Verified against Arduino AVR 1.8.8 bootloaders/stk500v2/stk500boot.c:
 * READ_SIGNATURE uses request[4], replies [command,OK,signature,OK].
 * SET_DEVICE_DESCRIPTOR is unsupported and CHIP_ERASE deliberately fails.
 * PROGRAM_FLASH erases each application page itself. Never write fuses.
 */
export function megaProgrammer(Base){return class ArduinoMegaProgrammer extends Base{
 async readSignature(){const result=new Uint8Array(3);for(let index=0;index<3;index++){const response=await this.send([0x1b,4,0x30,0,index,0]);if(response.length!==4||response[3]!==0)throw new Error('Invalid Mega bootloader signature response.');result[index]=response[2];}return result;}
 async setDeviceDescriptor(){this.log('debug','Arduino wiring bootloader uses its fixed device profile.');}
 async chipErase(){this.log('debug','Arduino wiring bootloader erases application pages as they are written.');}
};}
