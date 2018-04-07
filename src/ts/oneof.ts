import {Printer} from "../Printer";
import {OneofDescriptorProto, FieldDescriptorProto} from "google-protobuf/google/protobuf/descriptor_pb";
import {oneOfName} from "../util";
import {OneOfMessage} from "../../test/ts_test/generated/examplecom/oneof_message_pb";
import {MessageOneof} from "./fileDescriptorTSD";

export function printOneOfDecl(oneof: MessageOneof, indentLevel: number) {
  const printer = new Printer(indentLevel);

  printer.printLn(`export enum ${oneof.nameAsPascalCase}Case {`);

  printer.printIndentedLn(`${oneof.nameAsUpperCase}_NOT_SET = 0,`);
  oneOfFields.forEach(field => {
    printer.printIndentedLn(`${field.getName().toUpperCase()} = ${field.getNumber()},`);
  });
  printer.printLn("}");

  return printer.output;
}
