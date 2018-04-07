import {MESSAGE_TYPE, BYTES_TYPE} from "./FieldTypes";
import {Printer} from "../Printer";
import {MessageType} from "./fileDescriptorTSD";
import {printEnum} from "./enum";
import {printOneOfDecl} from "./oneof";

export function printMessage(messageType: MessageType, indentLevel: number) {
  if (messageType.isMapEntry) {
    return "";
  }

  /*
  if (field.hasOneofIndex()) {
    const oneOfIndex = field.getOneofIndex();
    let existing = oneOfGroups[oneOfIndex];
    if (existing === undefined) {
      existing = [];
      oneOfGroups[oneOfIndex] = existing;
    }
    existing.push(field);
  }
  */

  const objectTypeName = `AsObject`;
  const toObjectType = new Printer(indentLevel + 1);
  const printer = new Printer(indentLevel);
  printer.printEmptyLn();


  // const oneOfGroups: Array<Array<FieldDescriptorProto>> = [];
  toObjectType.printLn(`export type ${objectTypeName} = {`);
  messageType.fields
    .forEach(field => {
      if (field.isMap) {
        let keyTypeName = field.mapTypes.keyTypeName;
        if (field.mapTypes.keyType === MESSAGE_TYPE) {
          keyTypeName += `.${objectTypeName}`;
        }
        let valueTypeName = field.mapTypes.valueTypeName;
        if (field.mapTypes.valueType === MESSAGE_TYPE) {
          valueTypeName += `.${objectTypeName}`;
        }
        toObjectType.printIndentedLn(`${field.nameAsCamelCase}Map: Array<[${keyTypeName}, ${valueTypeName}]>,`);
      } else {
        if (field.isRepeated) {
          if (field.fieldType === BYTES_TYPE) {
            toObjectType.printIndentedLn(`${field.nameAsCamelCase}List: Array<Uint8Array | string>,`);
          } else {
            let typeName = field.jsTypeName;
            if (field.fieldType === MESSAGE_TYPE) {
              typeName += `.${objectTypeName}`;
            }
            toObjectType.printIndentedLn(`${field.nameAsCamelCase}List: Array<${typeName}>,`);
          }
        } else {
          if (field.fieldType === BYTES_TYPE) {
            toObjectType.printIndentedLn(`${field.nameAsCamelCase}: Uint8Array | string,`);
          } else {
            let typeName = field.jsTypeName;
            if (field.fieldType === MESSAGE_TYPE) {
              typeName += `.${objectTypeName}`;
            }
            toObjectType.printIndentedLn(`${field.nameAsCamelCase}${field.canBeUndefined ? "?" : ""}: ${typeName},`);
          }
        }
      }
    });
  toObjectType.printLn(`}`);

  printer.printLn(`export class ${messageType.name} extends jspb.Message {`);
  messageType.fields
    .forEach(field => {
      if (field.isMap) {
        printer.printIndentedLn(`get${field.nameAsPascalCase}Map(): jspb.Map<${field.mapTypes.keyTypeName}, ${field.mapTypes.valueTypeName}>;`);
        printer.printIndentedLn(`clear${field.nameAsPascalCase}Map(): void;`);
      } else {
        if (field.hasPresenceMethod) {
          printer.printIndentedLn(`has${field.nameAsPascalCase}(): boolean;`);
        }
        if (field.hasClearMethod) {
          let clearMethodName = `clear${field.nameAsPascalCase}`;
          if (field.isRepeated) {
            clearMethodName += "List";
          }
          printer.printIndentedLn(`${clearMethodName}(): void;`);
        }
        if (field.isRepeated) {
          if (field.fieldType === BYTES_TYPE) {
            printer.printIndentedLn(`get${field.nameAsPascalCase}List(): Array<Uint8Array | string>;`);
            printer.printIndentedLn(`get${field.nameAsPascalCase}List_asU8(): Array<Uint8Array>;`);
            printer.printIndentedLn(`get${field.nameAsPascalCase}List_asB64(): Array<string>;`);
            printer.printIndentedLn(`set${field.nameAsPascalCase}List(value: Array<Uint8Array | string>): void;`);
            printer.printIndentedLn(`add${field.nameAsPascalCase}(value: Uint8Array | string, index?: number): Uint8Array | string;`);
          } else {
            printer.printIndentedLn(`get${field.nameAsPascalCase}List(): Array<${field.jsTypeName}>;`);
            printer.printIndentedLn(`set${field.nameAsPascalCase}List(value: Array<${field.jsTypeName}>): void;`);
            let argumentName = "value";
            if (field.fieldType === MESSAGE_TYPE) {
              argumentName += "?";
            }
            printer.printIndentedLn(`add${field.nameAsPascalCase}(${argumentName}: ${field.jsTypeName}, index?: number): ${field.jsTypeName};`);
          }
        } else {
          if (field.fieldType === BYTES_TYPE) {
            printer.printIndentedLn(`get${field.nameAsPascalCase}(): Uint8Array | string;`);
            printer.printIndentedLn(`get${field.nameAsPascalCase}_asU8(): Uint8Array;`);
            printer.printIndentedLn(`get${field.nameAsPascalCase}_asB64(): string;`);
            printer.printIndentedLn(`set${field.nameAsPascalCase}(value: Uint8Array | string): void;`);
          } else {
            let valueType = field.jsTypeName;
            if (field.canBeUndefined) {
              valueType += " | undefined";
            }
            let argumentName = "value";
            if (field.fieldType === MESSAGE_TYPE) {
              argumentName += "?";
            }
            printer.printIndentedLn(`get${field.nameAsPascalCase}(): ${valueType};`);
            printer.printIndentedLn(`set${field.nameAsPascalCase}(${argumentName}: ${valueType}): void;`);
          }
        }
      }
    });

  messageType.oneofs
    .forEach(oneof => {
      const jsTypeName = `${oneof.nameAsPascalCase}Case`;
      printer.printIndentedLn(`get${jsTypeName}(): ${messageType.name}.${jsTypeName};`);
    });

  printer.printIndentedLn(`serializeBinary(): Uint8Array;`);
  printer.printIndentedLn(`toObject(includeInstance?: boolean): ${messageType.name}.${objectTypeName};`);
  printer.printIndentedLn(`static toObject(includeInstance: boolean, msg: ${messageType.name}): ${messageType.name}.${objectTypeName};`);
  printer.printIndentedLn(`static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};`);
  printer.printIndentedLn(`static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};`);
  printer.printIndentedLn(`static serializeBinaryToWriter(message: ${messageType.name}, writer: jspb.BinaryWriter): void;`);
  printer.printIndentedLn(`static deserializeBinary(bytes: Uint8Array): ${messageType.name};`);
  printer.printIndentedLn(`static deserializeBinaryFromReader(message: ${messageType.name}, reader: jspb.BinaryReader): ${messageType.name};`);

  printer.printLn(`}`);
  printer.printEmptyLn();

  printer.printLn(`export namespace ${messageType.name} {`);

  printer.print(toObjectType.getOutput());

  messageType.nestedTypes
    .forEach(nested => {
      const output = printMessage(nested, indentLevel + 1);
      if (output !== "") {
        printer.print(output);
      }
    });

  messageType.enumTypes
    .forEach(enumType => {
      printer.printEmptyLn();
      printer.print(printEnum(enumType, indentLevel + 1))
    });

  messageType.oneofs
    .forEach(oneOfDecl => {
      printer.printEmptyLn();
      printer.print(`${printOneOfDecl(oneOfDecl, indentLevel + 1)}`);
    });

  /*
  messageDescriptor.getExtensionList().forEach(extension => {
    printer.print(printExtension(fileName, exportMap, extension, indentLevel + 1));
  });
  */

  printer.printLn(`}`);

  return printer.getOutput();
}
