export class Char{
   constructor(name,baseHP,charclass,baseSTR,basePD,baseMD,baseINT,maxlevel,xpcurvetype,xpcurveM){
    this.name = name;
    this.class = charclass;
    this.baseHP = baseHP;
    this.baseINT = baseINT;
    this.baseMD = baseMD
    this.currentxp = 0;
    this.maxlevel = maxlevel;
    this.baseSTR = baseSTR;
    this.basePD = basePD;
    this.xpcurvetype = xpcurvetype;
    this.xpcurveM = xpcurveM;
   }
}
export class Party {
  constructor(...char) {
    this.members = char;
  }
}
