import {
  filePathToPseudoNamespace, filePathFromProtoWithoutExtension, getPathToRoot,
  withinNamespaceFromExportEntry, snakeToCamel, uppercaseFirst, isProto2
} from "../util";
import {ExportEnumEntry, ExportMap, ExportMessageEntry, isExportMessageEntry} from "../ExportMap";
import {Printer} from "../Printer";
import {
  DescriptorProto, EnumDescriptorProto, EnumValueDescriptorProto, FieldDescriptorProto,
  FileDescriptorProto, OneofDescriptorProto
} from "google-protobuf/google/protobuf/descriptor_pb";
import {WellKnownTypesMap} from "../WellKnown";
import {printMessage} from "./message";
import {printEnum} from "./enum";
import {printExtension} from "./extensions";
import {ImportDescriptor} from "../service/grpcweb";
import {BYTES_TYPE, ENUM_TYPE, getFieldType, getTypeName, MESSAGE_TYPE} from "./FieldTypes";

export class ProtoDescripor {
  private readonly proto: FileDescriptorProto;
  private readonly exportMap: ExportMap;
  private readonly pathToRoot: string;

  constructor(proto: FileDescriptorProto, exportMap: ExportMap) {
    this.proto = proto;
    this.exportMap = exportMap;
    this.pathToRoot = getPathToRoot(proto.getName())
  }

  get filename(): string {
    return this.proto.getName();
  }

  get packageName(): string {
    return this.proto.getPackage();
  }

  get protoVersion(): 2 | 3 {
    return isProto2(this.proto) ? 2 : 3;
  }

  get imports(): ImportDescriptor[] {
    const dependencies = this.proto.getDependencyList()
      .map(dependency => {
        const namespace = filePathToPseudoNamespace(dependency);
        if (dependency in WellKnownTypesMap) {
          return {
            namespace,
            path: WellKnownTypesMap[dependency],
          }
        } else {
          return {
            namespace,
            path: `${this.pathToRoot}${filePathFromProtoWithoutExtension(filePathFromProtoWithoutExtension(dependency))}`
          }
        }
      });
    const hostProto = {
      namespace: filePathToPseudoNamespace(this.filename),
      path: `${this.pathToRoot}${filePathFromProtoWithoutExtension(this.filename)}`,
    };
    return [ hostProto ].concat(dependencies);
  }

  get messageTypes(): MessageType[] {
    return this.proto.getMessageTypeList()
      .map(messageProto => new MessageType(messageProto, this.exportMap, this.proto));
  }
}

export class MessageType {
  private readonly messageProto: DescriptorProto;
  private readonly exportMap: ExportMap;
  private readonly fileProto: FileDescriptorProto;

  constructor(messageProto: DescriptorProto, exportMap: ExportMap, fileProto: FileDescriptorProto, ) {
    this.messageProto = messageProto;
    this.exportMap = exportMap;
    this.fileProto = fileProto;
  }

  get name(): string {
    return this.messageProto.getName();
  }

  get isMapEntry(): boolean {
    return this.messageProto.getOptions() && this.messageProto.getOptions().getMapEntry();
  }

  get fields(): MessageField[] {
    return this.messageProto.getFieldList()
      .map(field => new MessageField(field, this.exportMap, this.fileProto));
  }

  get oneofs(): MessageOneof[] {
    return this.messageProto.getOneofDeclList()
      .map(oneof => new MessageOneof(oneof))
  }


  get nestedTypes(): MessageType[] {
    return this.messageProto.getNestedTypeList()
      .map(nested => new MessageType(nested, this.exportMap, this.fileProto))
  }

  get enumTypes(): EnumType[] {
    return this.messageProto.getEnumTypeList()
      .map(enumType => new EnumType(enumType))
  }
}

export class EnumType {
  private readonly enumProto: EnumDescriptorProto;

  constructor(enumProto: EnumDescriptorProto) {
    this.enumProto = enumProto;
  }

  get name(): string {
    return this.enumProto.getName();
  }

  get values() {
    return this.enumProto.getValueList()
      .map(enumValueProto => new EnumValueType(enumValueProto))
  }
}

export class EnumValueType {
  private readonly enumValueProto: EnumValueDescriptorProto;

  constructor(enumValueProto: EnumValueDescriptorProto) {
    this.enumValueProto = enumValueProto;
  }

  get jsName(): string {
    return this.enumValueProto.getName().toUpperCase();
  }

  get jsValue(): number {
    return this.enumValueProto.getNumber();
  }
}

export class MessageOneof {
  private readonly proto: OneofDescriptorProto;

  constructor(proto: OneofDescriptorProto) {
    this.proto = proto;
  }

  get nameAsPascalCase(): string {
    return uppercaseFirst(snakeToCamel(this.proto.getName()));
  }

  get nameAsUpperCase: string {
    return this.proto.getName().toUpperCase();
  }
}

export class MessageField {
  private readonly proto: FieldDescriptorProto;
  private readonly exportMap: ExportMap;
  private readonly fileProto: FileDescriptorProto;

  constructor(proto: FieldDescriptorProto, exportMap: ExportMap, fileProto: FileDescriptorProto) {
    this.proto = proto;
    this.exportMap = exportMap;
    this.fileProto = fileProto;
  }

  get nameAsSnakeCase(): string {
    return this.proto.getName().toLowerCase();
  }

  get nameAsCamelCase(): string {
    return snakeToCamel(this.nameAsSnakeCase);
  }

  get nameAsPascalCase(): string {
    return uppercaseFirst(this.nameAsCamelCase);
  }

  get isRepeated(): boolean {
    return this.proto.getLabel() === FieldDescriptorProto.Label.LABEL_REPEATED;
  }

  get canBeUndefined(): boolean {
    return this.proto.getLabel() === FieldDescriptorProto.Label.LABEL_OPTIONAL;
  }

  get fieldType(): FieldDescriptorProto.Type {
    return this.proto.getType();
  }

  get typeName(): string {
    return this.proto.getTypeName().slice(1)
  }

  get isMap(): boolean {
    const exportMapEntry = this.exportMapEntry;
    if (isExportMessageEntry(exportMapEntry) && exportMapEntry.messageOptions !== undefined) {
      return exportMapEntry.messageOptions.getMapEntry();
    }
    return false;
  }

  get mapTypes(): MapExportTypes {
    if (!this.isMap) {
      throw new Error("Invalid usage: expected field to be a Map");
    }
    const options = (this.exportMapEntry as ExportMessageEntry).mapFieldOptions!;
    const { key, value } = options;
    const keyTypeName = getFieldType(key[0], key[1], this.fileProto.getName(), this.exportMap);
    let valueTypeName;
    if (this.fieldType === BYTES_TYPE) {
      valueTypeName = "Uint8Array | string";
    } else {
      valueTypeName = getFieldType(value[0], value[1], this.fileProto.getName(), this.exportMap);
    }
    return { keyTypeName, keyType: key[0], valueTypeName, valueType: value[0] };
  }

  get hasPresenceMethod(): boolean {
    if (this.proto.getLabel() === FieldDescriptorProto.Label.LABEL_REPEATED) {
      return false;
    }
    if (this.proto.hasOneofIndex()) {
      return true;
    }
    if (this.proto.getType() === MESSAGE_TYPE) {
      return true;
    }
    return isProto2(this.fileProto);
  }

  get hasClearMethod(): boolean {
    return this.hasPresenceMethod || this.proto.getLabel() === FieldDescriptorProto.Label.LABEL_REPEATED;
  }

  private get exportMapEntry(): ExportMessageEntry | ExportEnumEntry | undefined {
    let exportEntry: ExportMessageEntry | ExportEnumEntry | undefined;
    let isBuiltInType = false;

    switch (this.fieldType) {
      case MESSAGE_TYPE:
        exportEntry = this.exportMap.getMessage(this.typeName);
        break;
      case ENUM_TYPE:
        exportEntry = this.exportMap.getEnum(this.typeName);
        break;
      default:
        isBuiltInType = true;
        break;
    }

    if (!isBuiltInType && exportEntry === undefined) {
      throw new Error(`Could not resolve Type: '${this.typeName}' in '${this.fileProto.getName()}'`);
    }
    return exportEntry;
  }

  get jsTypeName(): string {
    const exportEntry = this.exportMapEntry;
    if (exportEntry === undefined) {
      return getTypeName(this.fieldType);
    } else  {
      let typeName = withinNamespaceFromExportEntry(this.typeName, exportEntry);
      if (exportEntry.fileName !== this.fileProto.getName()) {
        typeName = `${filePathToPseudoNamespace(exportEntry.fileName)}.${typeName}`;
      }
      return typeName;
    }
  }
}

export type MapExportTypes = {
  keyType: FieldDescriptorProto.Type
  keyTypeName: string
  valueType: FieldDescriptorProto.Type
  valueTypeName: string
}

export type ExportType = {
  importNamespace: string
  typeName: string
}

export function printFileDescriptorTSD(fileDescriptor: FileDescriptorProto, exportMap: ExportMap) {
  const protoDescriptor = new ProtoDescripor(fileDescriptor, exportMap);
  const printer = new Printer(0);

  const fileName = protoDescriptor.filename;

  printer.printLn(`// package: ${protoDescriptor.packageName}`);
  printer.printLn(`// file: ${protoDescriptor.filename}`);

  printer.printEmptyLn();
  printer.printLn(`import * as jspb from "google-protobuf";`);

  protoDescriptor.imports
    .forEach(importDescriptor => {
      printer.printLn(`import * as ${importDescriptor.namespace} from "${importDescriptor.path}";`);
    });

  protoDescriptor.messageTypes
    .forEach(messageType => {
      printer.print(printMessage(messageType, 0));
    });

  fileDescriptor.getExtensionList().forEach(extension => {
    printer.print(printExtension(fileName, exportMap, extension, 0));
  });

  fileDescriptor.getEnumTypeList().forEach(enumType => {
    printer.print(printEnum(enumType, 0));
  });

  printer.printEmptyLn();

  return printer.getOutput();
}
