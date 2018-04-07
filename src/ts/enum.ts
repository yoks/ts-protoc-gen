import {Printer} from "../Printer";
import {EnumType} from "./fileDescriptorTSD";

export function printEnum(enumType: EnumType, indentLevel: number) {
  const printer = new Printer(indentLevel);
  printer.printLn(`export enum ${enumType.name} {`);
  enumType.values
    .forEach(value => {
      printer.printIndentedLn(`${value.jsName} = ${value.jsValue},`);
    });
  printer.printLn(`}`);
  return printer.getOutput();
}
