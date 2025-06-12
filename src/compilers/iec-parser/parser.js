/* eslint-disable curly */
/* eslint-disable eqeqeq */
// Copyright [2025] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/**
 * @description IEC Project Parser
 * @author Nathan Skipper, MTI
 * @version 1.0.2
 * @copyright Apache 2.0
 */

import {DOMParser} from "xmldom";

/**
 * Tests whether an object value is null or undefined.
 * @param {Object} obj 
 * @returns Returns True of the object is valid, or false if it is null or undefined.
 */
function isValid(obj){
    return obj !== null && typeof obj !== "undefined";
}

/**
 * Determines whether the value is a primitive type.
 * @param {*} val The value to evaluate.
 * @returns {boolean} Returns true if the value is a primitive type.
 */
function isPrimitive(val) {
  return (
    val === null ||
    typeof val === 'string' ||
    typeof val === 'number' ||
    typeof val === 'boolean' ||
    typeof val === 'undefined'
  );
}

/**
 * Determines whether the value is an array.
 * @param {*} val The value to evaluate.
 * @returns {boolean} returns true if the value is an array.
 */
function isArray(val) {
  return Array.isArray(val);
}

function forEachElem(array, action){
    for(var x = 0; x < array.length; x++){
        action(array[x]);
    }
}

/**
 * Evaluates whether a value is an object.
 * @param {*} val The value to evaluate.
 * @returns {boolean} returns true if the value is an object.
 */
function isObject(val) {
  return typeof val === 'object' && val !== null && !isArray(val);
}
/**
 * Creates a new SVG element based on the SVG provided.
 * @param {string} htmlString The svg code to use in generating a new element. Note: the svg code must be wrapped in a containing element, such as a "g".
 * @param {boolean} includeSVG Indicates whether to include a containing SVG around the created element.
 * @returns {SVGElement} Returns a new SVG element.
 */
function createElementFromSVG(htmlString, includeSVG = false) {
    const doc = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    doc.innerHTML = htmlString.trim();
    
    return includeSVG ? doc.cloneNode(true) : doc.firstChild.cloneNode(true);
}

/**
 * Provides a new GUID.
 * @returns {string} Returns a GUID string.
 */
function generateGUID() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8); // y is 8, 9, A, or B
      return v.toString(16);
    });
  }

    /**
     * Creates a timestamp string of the current date and time.
     * @returns {string} Returns a string of the current date and time in yyyyMMddHHmmss format.
     */
    function formatTimestamp() {
        const now = new Date(Date.now());
    
        const yyyy = now.getFullYear();
        const MM = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
    
        return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
    }

    
/**
 * An abstract class which will provide definition for serializing any inheriting class
 * into json or from json. The inheriting class must extend the "TypeMap" property defined
 * by this class to provide types for the properties of the class. Primitive types must be
 * assigned default values instead of the class name of the type. For example, a property
 * that has is a number should be "IntProperty": 0.
 */
export class Serializable{
    constructor(){
        this.TypeMap = {};
    }

    /**
     * Converts this object to a json string based on the defined TypeMap.
     * @returns {string} returns the json string representing this object.
     */
    toJSON() {
        const obj = {};
        for (const key in this.TypeMap) {
            if(this.hasOwnProperty(key)){
                var value = this[key];
                if (isPrimitive(value)) {
                    obj[key] = value;
                } else if (isArray(value)) {
                    obj[key] = value.map(item =>
                        isPrimitive(item) ? item : item?.toJSON?.() ?? item
                );
                } else if (isObject(value)) {
                    obj[key] = value?.toJSON?.() ?? value;
                } else {
                    obj[key] = value; // fallback
                }
            }
            
        }
        return JSON.stringify(obj);
    }

    /**
     * Populates the object with the values of the json string, based on the TypeMap definition.
     * @param {string} json The json string from which to populate the properties of the object.
     * @param {Object?} parent The parent to add to this object, if it has a Parent property.
     * @returns {Object} Returns the object after populating its properties.
     */
    fromJSON(json, parent){
        var jsonObj = JSON.parse(json);
        for (const [key, value] of Object.entries(jsonObj)) {
            const Type = this.TypeMap[key];

            if (isValid(value)) {
                if (Array.isArray(value)) {
                    this[key] = value.map(item => {
                        if (isPrimitive(item)) {
                        return item;
                        } else if (Type && typeof Type === 'function') {
                            const instance = new Type();
                            return instance.fromJSON(item, this);
                        } else {
                        return item;
                    }
                });
                } else if (isPrimitive(value)) {
                    this[key] = value;
                } else if (Type && typeof Type === 'function') {
                    const instance = new Type();
                this[key] = instance.fromJSON(value, this);
                } else {
                    this[key] = value;
                }
            } 
        }
        if(this.hasOwnProperty("Parent")){
            this.Parent = parent;
        }
        return this;
    }
}
    
/**
 * The Project class represents the XML data for a Project element in the IEC file.
 */
export class Project extends Serializable {

    /**
     * Constructs a new Project object based on the child elements.
     * @param {FileHeader?} fileHeader Can be undefined, but if provided, sets the FileHeader property to what is provided.
     * @param {ContentHeader?} contentHeader Can be undefined, but if provided, sets the ContentHeader property to what is provided.
     * @param {Types?} types Can be undefined, but if provided, sets the Types property.
     * @param {Instances?} instances Not used currently.
     */
    constructor(fileHeader, contentHeader, types, instances, mappingTable) {
        super();
        this.TypeMap = {
            "FileHeader": FileHeader,
            "ContentHeader": ContentHeader,
            "Types": Types,
            "Instances": Instances,
            "MappingTable": MappingTable
         };
         /**@type {FileHeader} */
        this.FileHeader = new FileHeader();
        /**@type {ContentHeader} */
        this.ContentHeader = new ContentHeader();
        /**@type {Types} */
        this.Types = new Types();
        /**@type {Instances} */
        this.Instances = new Instances();
        this.MappingTable = new MappingTable();
        if(isValid(fileHeader)) {this.FileHeader = fileHeader;}
        if(isValid(contentHeader)) {this.ContentHeader = contentHeader;}
        if(isValid(types)) {this.Types = types;}

        if(isValid(instances)) this.Instances = instances;
        if(isValid(mappingTable)) this.MappingTable = mappingTable;
    }

    /**
     * Parses a string of xml representing the complete project file and sets the properties of a new Project object based on it.
     * @param {String} xml A string containing the xml to parse.
     * @returns A new Project object.
     */
    static fromXML(xml) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, "text/xml");
        
        const proj = new Project(
            FileHeader.fromXML(xmlDoc.getElementsByTagName("FileHeader")[0]),
            ContentHeader.fromXML(xmlDoc.getElementsByTagName("ContentHeader")[0]),
            null,
            null
        );
        proj.Types = Types.fromXML(xmlDoc.getElementsByTagName("Types")[0], proj);
        proj.Instances = Instances.fromXML(xmlDoc.getElementsByTagName("Instances")[0], proj);
        proj.MappingTable = MappingTable.fromXML(xmlDoc.getElementsByTagName("MappingTable")[0], proj);
        if(!isValid(proj.Types)) proj.Types = new Types(null, proj);
        if(!isValid(proj.Instances)) proj.Instances = new Instances(null, proj);
        if(!isValid(proj.MappingTable)) proj.MappingTable = new MappingTable();
        return proj;
    }

    /**
     * Formats the object as an XML string.
     * @returns A string representation of the Project object.
     */
    toXML() {
        return `<?xml version="1.0" encoding="utf-8"?>
                <Project xmlns="www.iec.ch/public/TC65SC65BWG7TF10" 
                        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                        xsi:schemaLocation="www.iec.ch/public/TC65SC65BWG7TF10 IEC61131_10_Ed1_0.xsd"
                        schemaVersion="1.0">
                    ${this.FileHeader.toXML()}
                    ${this.ContentHeader.toXML()}
                    ${this.Types.toXML()}
                    ${this.Instances.toXML()}
                    ${this.MappingTable.toXML()}
                </Project>`;
    }

    getAllPrograms(){
        var programs = [];
        try{
            forEachElem(this.Types.GlobalNamespace.NamespaceDecl.Programs,
                (p) => {
                    programs.push(p);
                }
            );
        }
        catch(e){
            console.error(e);
        }
        return programs;
    }

    getAllFunctionBlocks(){
        var fbs = [];
        try{
            forEachElem(this.Types.GlobalNamespace.NamespaceDecl.FunctionBlocks,
                (p) => {
                    fbs.push(p);
                }
            );
        }
        catch(e){
            console.error(e);
        }
        return fbs;
    }

    /**
     * Finds the containing Project for the child.
     * @param {FbdObject|LdObject|Rung|Network|BodyContent|MainBody|Program|FunctionBlock|NamespaceDecl|GlobalNamespace|Types} child The child object from which to find the containing Project.
     * @returns Returns the Project for the child, or null if not found.
     */
    static getProject(child){
        return Project.getParentOfType(child, Project);
    }

    /**
     * Finds the containing parent for the child that matches the specified type.
     * @param {FbdObject|LdObject|Rung|Network|BodyContent|MainBody|Program|FunctionBlock|NamespaceDecl|GlobalNamespace|Types} child The child object from which to find the containing Project.
     * @param {class} type The class type to search for.
     * @returns Returns the parent object of the specified type for the child, or null if not found.
     */
    static getParentOfType(child, type){
        var ret = null;
        try{
            ret = child;
            while(isValid(ret.Parent) && !(ret instanceof type)){
                ret = ret.Parent;
            }
            
        }
        catch(e){
            console.error(e);
        }
        return ret;
    }
}

/**
 * Represents the FileHeader element of an IEC file.
 */
export class FileHeader extends Serializable {
    /**
     * Instantiates a new FileHeader object based on provided information.
     * @param {string?} companyName Can be undefined, but if provided, sets the companyName property.
     * @param {string?} companyURL Can be undefined, but if provided, sets the companyURL property.
     * @param {string?} productName Can be undefined, but if provided, sets the productName property.
     * @param {string?} productVersion Can be undefined, but if provided, sets the productVersion property.
     * @param {strin?} productRelease Can be undefined, but if provided, sets the productRelease property.
     */
    constructor(companyName, companyURL, productName, productVersion, productRelease) {
        super();
        this.TypeMap = {
            "companyName": "",
            "companyURL": "",
            "productName": "",
            "productVersion": "",
            "productRelease": ""
         };
        this.companyName = "";
        this.companyURL = "";
        this.productName = "";
        this.productVersion = "";
        this.productRelease = "";
        if(isValid(companyName)) {this.companyName = companyName;}
        if(isValid(companyURL)) {this.companyURL = companyURL;}
        if(isValid(productName)) {this.productName = productName;}
        if(isValid(productVersion)) {this.productVersion = productVersion;}
        if(isValid(productRelease)) {this.productRelease = productRelease;}
    }

    /**
     * Creates a new FileHeader object based on an Element object representing the XML.
     * @param {Element} xml The xml element to parse.
     * @returns Returns a new FileHeader object.
     */
    static fromXML(xml) {
        if(!isValid(xml)) {return null;}
        return new FileHeader(
            xml.getAttribute("companyName"),
            xml.getAttribute("companyURL"),
            xml.getAttribute("productName"),
            xml.getAttribute("productVersion"),
            xml.getAttribute("productRelease")
        );
    }

    /**
     * 
     * @returns Returns a string of XML representing the object.
     */
    toXML() {
        return `<FileHeader companyName="${this.companyName}" companyURL="${this.companyURL}"
                    productName="${this.productName}" productVersion="${this.productVersion}"
                    productRelease="${this.productRelease}"/>`;
    }
}

/**
 * Represents the ContentHeader element in an IEC project file.
 */
export class ContentHeader extends Serializable {
    /**
     * Instantiates a new ContentHeader based on properties provided.
     * @param {string?} name Can be null or undefined.
     * @param {string?} version Can be null or undefined.
     * @param {string?} creationDateTime Can be null or undefined.
     * @param {string?} modificationDateTime Can be null or undefined.
     * @param {string?} organization Can be null or undefined.
     * @param {string?} author Can be null or undefined.
     * @param {string?} language Can be null or undefined.
     */
    constructor(name, version, creationDateTime, modificationDateTime, organization, author, language) {
        super();
        this.TypeMap = {
            "name": "",
            "version": "",
            "creationDateTime": "",
            "modificationDateTime": "",
            "organization": "",
            "author": "",
            "language": ""
         };
        this.Name = "New";
        this.version = "1.0";
        this.creationDateTime = Date.now().toString();
        this.modificationDateTime = Date.now().toString();
        this.organization = "";
        this.author = "";
        this.language = "En";

        if(isValid(name)) {this.Name = name;}
        if(isValid(version)) {this.version = version;}
        if(isValid(creationDateTime)) {this.creationDateTime = creationDateTime;}
        if(isValid(modificationDateTime)) {this.modificationDateTime = modificationDateTime;}
        if(isValid(organization)) {this.organization = organization;}
        if(isValid(author)) {this.author = author;}
        if(isValid(language)) {this.language = language;}
    }
    /**
     * Creates a new ContentHeader object based on an XML element object.
     * @param {Element} xml An Element object representing the XML.
     * @returns A new ContentHeader object.
     */
    static fromXML(xml) {
        if(!isValid(xml)) {return null;}
        return new ContentHeader(
            xml.getAttribute("name"),
            xml.getAttribute("version"),
            xml.getAttribute("creationDateTime"),
            xml.getAttribute("modificationDateTime"),
            xml.getAttribute("organization"),
            xml.getAttribute("author"),
            xml.getAttribute("language"));
    }
    /**
     * 
     * @returns Returns an string of xml representing the object.
     */
    toXML() {
        return `<ContentHeader name="${this.Name}" version="${this.version}" creationDateTime="${this.creationDateTime}"
                    modificationDateTime="${this.modificationDateTime}" organization="${this.organization}" author="${this.author}" language="${this.language}">
                </ContentHeader>`;
    }
}

/**
 * Defines the coordinate info for the IEC file. This provides scaling for the diagram types.
 */
export class CoordinateInfo extends Serializable{
    /**
     * 
     * @param {Scaling?} FbdScaling 
     * @param {Scaling?} LdScaling 
     * @param {Scaling?} SfcScaling 
     */
    constructor(FbdScaling, LdScaling, SfcScaling) {
        super();
        this.TypeMap = {
            "FbdScaling": Scaling,
            "LdScaling": Scaling,
            "SfcScaling": Scaling
         };
        this.FbdScaling = new Scaling(1, 1);
        this.LdScaling = new Scaling(1, 1);
        this.SfcScaling = new Scaling(1, 1);
        if(isValid(FbdScaling)) this.FbdScaling = FbdScaling;
        if(isValid(LdScaling)) this.LdScaling = LdScaling;
        if(isValid(SfcScaling)) this.SfcScaling = SfcScaling;
        
    }

    /**
     * Creates a new CoordinateInfo object based on an XML element.
     * @param {Element} xml The XML element from which to get the object's properties.
     * @returns {CoordinateInfo} Returns a new object based on the XML.
     */
    static fromXML(xml) {
        if(!isValid(xml)) {return null;}
        return new CoordinateInfo(
            Scaling.fromXML(xml.getElementsByTagName("FbdScaling")[0]),
            Scaling.fromXML(xml.getElementsByTagName("LdScaling")[0]),
            Scaling.fromXML(xml.getElementsByTagName("SfcScaling")[0])
        );
    }

    /**
     * Creates an xml string representing the object.
     * @returns {string} Returns the XML string representing the object.
     */
    toXML() {
        return `<CoordinateInfo>
                    ${this.FbdScaling.toXML()}
                    ${this.LdScaling.toXML()}
                    ${this.SfcScaling.toXML()}
                </CoordinateInfo>`;
    }
}

/**
 * Implements the scaling for an IEC file.
 */
export class Scaling extends Serializable{
    /**
     * Constructs a new Scaling object.
     * @param {string?} x The x scale factor
     * @param {string?} y The y scale factor.
     */
    constructor(x, y) {
        super();
        this.TypeMap = {
            "x": "",
            "y": ""
         };
         this.x = "1";
         this.y = "1";
        if(isValid(x)) this.x = x;
        if(isValid(y)) this.y = y;
    }

    /**
     * Creates a new scaling object based on the xml element.
     * @param {Element} xml The XML element from which to create the object.
     * @returns {Scaling} A new scaling object.
     */
    static fromXML(xml) {
        if(!isValid(xml)) {return null;}
        return new Scaling(
            xml.getAttribute("x"),
            xml.getAttribute("y")
        );
    }

    /**
     * Creates an xml string representing the object.
     * @returns {string} An xml string representing the object.
     */
    toXML() {
        return `<Scaling x="${this.x}" y="${this.y}"/>`;
    }
}

/**
 * Represents the Types element in an IEC project file.
 */
export class Types extends Serializable{
    /**
     * Instantiates a new Types object.
     * @param {GlobalNamespace?} globalNamespace Can be null or undefined.
     * @param {Project?} parent The containing project.
     */
    constructor(globalNamespace, parent) {
        super();
        this.TypeMap = {
            "GlobalNameSpace": GlobalNamespace
         };
        this.GlobalNamespace = new GlobalNamespace();
        this.Parent = null;
        if(isValid(globalNamespace)) {this.GlobalNamespace = globalNamespace;}
        if(isValid(parent)) this.Parent = parent;
    }
    /**
     * Creates a new Types object based on an XML element.
     * @param {Element} xml An element object representing the XML for the types.
     * @param {Project} parent The containing project.
     * @returns Returns a new Types object.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) {return null;}
        const type = new Types(null, parent);
        const gns = GlobalNamespace.fromXML(xml.getElementsByTagName("GlobalNamespace")[0], type);
        type.GlobalNamespace = gns;
        return type;
    }
    /**
     * 
     * @returns Returns a string representing the xml of this object.
     */
    toXML() {
        return `<Types>
                    ${this.GlobalNamespace.toXML()}
                </Types>`;
    }

    toST(){
        return this.GlobalNamespace.toST();
    }
}

/**
 * Represents the GlobalNamespace element of the IEC project file.
 */
export class GlobalNamespace extends Serializable {
    /**
     * Constructs a new GlobalNamespace object.
     * @param {NamespaceDecl?} namespaceDecl Can be null or undefined.
     * @param {Types?} parent The containing object.
     */
    constructor(namespaceDecl, parent) {
        super();
        this.TypeMap = {
            "NamespaceDecl": NamespaceDecl
         };
         /**@type {NamespaceDecl} */
        this.NamespaceDecl = new NamespaceDecl();
        this.Parent = null;
        if(isValid(namespaceDecl)) {this.NamespaceDecl = namespaceDecl;}
        if(isValid(parent)) this.Parent = parent;
    }
    /**
     * Creates a new GlobalNamespace object based on an XML element.
     * @param {Element} xml An xml Element object from which to create the GlobalNamespace.
     * @returns Returns a new GlobalNamespace object.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) {return null;}
        const gns = new GlobalNamespace(null , parent);
        gns.NamespaceDecl = NamespaceDecl.fromXML(xml.getElementsByTagName("NamespaceDecl")[0], gns);
        return gns;
    }

    /**
     * 
     * @returns Returns a string of xml representing the object.
     */
    toXML() {
        return `<GlobalNamespace>
                    ${this.NamespaceDecl.toXML()}
                </GlobalNamespace>`;
    }

    toST(){
        return this.NamespaceDecl.toST();
    }
}

/**
 * Represents the NamespaceDecl element of an IEC project file.
 */
export class NamespaceDecl extends Serializable{
    /**
     * Instantiates a new NamespaceDecl object.
     * @param {string?} name Can be null or undefined.
     * @param {GlobalNamespace?} parent The containing object.
     */
    constructor(name, parent) {
        super();
        this.TypeMap = {
            "name": "",
            "Programs": [],
            "FunctionBlocks": []
         };
        /**
         * @type {string}
         */
        this.Name = "Default";
        /**
         * @type {Program[]}
         */
        this.Programs = [];
        /**
         * @type {FunctionBlock[]}
         */
        this.FunctionBlocks = [];
        /**
         * @type {GlobalNamespace}
         */
        this.Parent = null;
        if(isValid(name)) {this.Name = name;}
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates a new NamespaceDecl object from the given xml element.
     * @param {Element} xml The XML element to parse.
     * @param {GlobalNamespace} parent The containing object.
     * @returns instantiated NamespaceDecl object based on xml. 
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) {return null;}
        var ns =  new NamespaceDecl(
            xml.getAttribute("name"), parent
        );
        var xmlprogs = xml.getElementsByTagName("Program");
        var xmlfb = xml.getElementsByTagName("FunctionBlock");
        if(!isValid(ns.Programs)) {ns.Programs = [];}
        if(!isValid(ns.FunctionBlocks)) {ns.FunctionBlocks = [];}
        forEachElem(xmlprogs, (prog) => {
            ns.Programs.push(Program.fromXML(prog, ns));
        });
        forEachElem(xmlfb, (fb) => {
            ns.FunctionBlocks.push(FunctionBlock.fromXML(fb, ns));
        });
        return ns;
    }
    /**
     * 
     * @returns Returns a string of xml representing the object.
     */
    toXML() {
        var progs = "";
        var fbs = "";
        forEachElem(this.Programs, (elem) => {
            progs += elem.toXML();
        });
        forEachElem(this.FunctionBlocks, (elem) => {
            fbs += elem.toXML();
        });
        return `<NamespaceDecl name="${this.Name}">
        ${progs}
        ${fbs}
        </NamespaceDecl>`;
    }

    /**
     * Converts all elements of this namespace to structured text.
     * @returns {string} A string representing the structured text.
     */
    toST(){
        var blocks = "";
        var programs = "";
        forEachElem(this.FunctionBlocks, (f) => blocks += f.toST() + "\n");
        forEachElem(this.Programs, (p) => programs += p.toST() + "\n");
        return `${blocks}
        ${programs}`;
    }

    /**
     * Adds options to a given element for all variable types defined within this namespace, or as a standard function block.
     * @param {HTMLElement} elem The element to add the options to.
     */
    addVariableTypes(elem){
        try{
            forEachElem(FbdObject.StandardBlocks, sb => {
                var opt = document.createElement("option");
                opt.value = sb.TypeName;
                opt.textContent = sb.TypeName;
                elem.appendChild(opt);
            });
            forEachElem(this.FunctionBlocks, sb => {
                var opt = document.createElement("option");
                opt.value = sb.Name;
                opt.textContent = sb.Name;
                elem.appendChild(opt);
            });
        }
        catch(e){
            console.error(e);
        }
    }
}

/**
 * Represents the instances list for the IEC file.
 */
export class Instances extends Serializable {
    /**
     * Constructs a new Instances object.
     * @param {Configuration[]?} configurations The configurations for the instances.
     *  @param {Project?} parent The parent that owns this object.
     */
    constructor(configurations, parent) {
        super();
        this.TypeMap = {
            "Configurations": []
        };
        this.Configurations = [];
        this.Parent = null;
        if(isValid(configurations)) this.Configurations = configurations;
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates an object from an xml element.
     * @param {Element} xml The xml element from which to create the object.
     * @param {Project?} parent The parent that owns this object.
     * @returns {Instances} A new object.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) {return null;}
        var obj = new Instances();
        if(isValid(parent)) obj.Parent = parent;
        var configs = xml.getElementsByTagName("Configuration");
        forEachElem(configs, (c) => {
            obj.Configurations.push(Configuration.fromXML(xml, obj));
        });
        return obj;
    }

    /**
     * Creates an xml string representing the object.
     * @returns {string} An xml string representing the object.
     */
    toXML() {
        var configs = "";
        forEachElem(this.Configurations, (c) => {
            configs += c.toXML() + "\n";
        });
        return `<Instances>
                    ${configs}
                </Instances>`;
    }

}

/**
 * A configuration for the IEC file.
 */
export class Configuration extends Serializable{
    /**
     * Constructs a new configuration object.
     * @param {string?} name The name of the configuration.
     * @param {Resource[]?} resources An array of resources.
     * @param {Instances?} parent The parent that owns this object.
     */
    constructor(name, resources, parent) {
        super();
        this.TypeMap = {
            "Name": "",
            "Resources": []
         };
        this.Parent = null;
        this.Resources = [];
        this.Name = "Main";
        if(isValid(parent)) this.Parent = parent;
        if(isValid(name)) this.Name = name;
        if(isValid(resources)) this.Resources = resources;
    }

    /**
     * Creates a new Configuration object based on the XML element.
     * @param {Element} xml The xml element to create the object from.
     * @param {Instances} parent The parent that owns this object.
     * @returns {Configuration} Returns the configuration object.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) {return null;}
        var obj = new Configuration(xml.getAttribute("name"),null, parent);
        forEachElem(xml.getElementsByTagName("Resource"), (r) => {
            obj.Resources.push(Resource.fromXML(r, obj));
        });
        return obj;
    }

    /**
     * Creates an xml string representing the object.
     * @returns {string} An xml string representing the object.
     */
    toXML() {
        var resources = "";
        forEachElem(this.Resources, (r) => {
            resources += r.toXML() + "\n";
        });
        return `<Configuration name="${this.Name}">
                    ${resources}
                </Configuration>`;
    }

}

/**
 * Represents a Resource element in an IEC file.
 */
export class Resource extends Serializable{
    /**
     * Constructs a new resource object.
     * @param {string?} name The name of the resource.
     * @param {string?} resourceTypeName The type of the resource.
     * @param {GlobalVars?} globalVars A GlobalVars objects.
     * @param {Task[]?} tasks An array of tasks.
     * @param {ProgramInstance[]?} programInstances An array of program instances. 
     * @param {Configuration?} parent The parent that owns this object.
     */
    constructor(name, resourceTypeName, globalVars, tasks, programInstances, parent) {
        super();
        this.TypeMap = {
            "Name": "",
            "ResourceTypeName": "",
            "GlobalVars": GlobalVars,
            "Tasks": [],
            "ProgramInstances": []
         };
         this.Name = "Main";
         this.ResourceTypeName = "";
         this.GlobalVars = new GlobalVars(null, this);
         this.Tasks = [];
         this.ProgramInstances = [];
         this.Parent = null;
        if(isValid(name)) this.Name = name;
        if(isValid(resourceTypeName)) this.ResourceTypeName = resourceTypeName;
        if(isValid(globalVars)) this.GlobalVars = globalVars;
        if(isValid(tasks)) this.Tasks = tasks;
        if(isValid(programInstances)) this.ProgramInstances = programInstances;
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates a new object based on the xml element.
     * @param {Element} xml The xml element to create the object from.
     * @param {Configuration?} parent The parent that will own the object. 
     * @returns {Resource} Returns a new resource object based on the Xml.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) {return null;}
        var obj = new Resource(xml.getAttribute("name"), xml.getAttribute("resourceTypeName"), null, null, null, parent);
        obj.GlobalVars = GlobalVars.fromXML(xml.getElementsByTagName("GlobalVars")[0]);
        forEachElem(xml.getElementsByTagName("Task"), (t) => {
            obj.Tasks.push(Task.fromXML(t, obj));
        });
        forEachElem(xml.getElementsByTagName("ProgramInstance"), (p) => {
            obj.ProgramInstances.push(ProgramInstance.fromXML(p, obj));
        });
        return obj;
    }

    /**
     * Creates an xml string representing the object.
     * @returns {string} Returns an xml string of the object.
     */
    toXML() {
        var tasks = "";
        var progs = "";
        
        forEachElem(this.Tasks, (t) => {
            tasks += t.toXML() + "\n";
        });
        forEachElem(this.ProgramInstances, (p) => {
            progs += p.toXML() + "\n";
        });
        return `<Resource name="${this.Name}" resourceTypeName="${this.ResourceTypeName}">
                    ${this.GlobalVars.toXML()}
                    ${tasks}
                    ${progs}
                </Resource>`;
    }

    /**
     * Converts the resource's programming to Structured Text.
     * @returns {string} Returns a string representing the structured text.
     */
    toST(){
        var tasks = "";
        var progs = "";
        var vars = "";
        var included = "";
        var map = this.Parent.Parent.Parent.MappingTable.toST(this.Name);
        var programs = this.Parent.Parent.Parent.getAllPrograms();
        var fbs = this.Parent.Parent.Parent.getAllFunctionBlocks();
        forEachElem(fbs, fb => included += fb.toST() + "\n");
        forEachElem(this.Tasks, t => tasks += t.toST());
        forEachElem(this.ProgramInstances, 
            /**
             * 
             * @param {ProgramInstance} p 
             */
            p => {
                progs += p.toST();
                
                var incProg = programs.find(pr => pr.Name === p.TypeName);
                if(isValid(incProg)){
                    included += incProg.toST() + "\n";
                }
            });
        forEachElem(this.GlobalVars.Variables, 
            /**
             * 
             * @param {Variable} v 
             */
            (v) => {
                vars += `${v.Name} ${isValid(v.Address) ?  " AT %" + v.Address.Location + v.Address.Size + v.Address.Address : ""} : ${v.Type.TypeName};\n`;
            }

        );
        var res = 
`
${map}
${tasks}
${progs}
VAR_GLOBAL
    ${vars}
END_VAR
${included}`;
        return res;
    }
}

/**
 * Represents a GlobalVars element in the IEC file.
 */
export class GlobalVars extends Serializable{
    /**
     * Constructs a new GlobalVars object.
     * @param {Variable[]?} variables An array of variables.
     * @param {Resource?} parent The parent that owns this object.
     */
    constructor(variables, parent){
        super();
        this.TypeMap = {
            "Variables": []
        };
        this.Variables = [];
        this.Parent = null;
        if(isValid(variables)) this.Variables = variables;
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates a new object based on the xml element.
     * @param {Element} xml The xml element from which to create the object.
     * @param {Resource?} parent The parent that owns the object.
     * @returns {GlobalVars?} Returns a new GlobalVars object from the xml.
     */
    static fromXML(xml, parent){
        if(!isValid(xml)) return null;
        var obj = new GlobalVars(null, parent);
        forEachElem(xml.getElementsByTagName("Variable"), v => {
            obj.Variables.push(Variable.fromXML(v));
        });
        return obj;
    }

    /**
     * Creates an xml string representation of the object.
     * @returns {string} Returns an xml string of the object.
     */
    toXML(){
        var v = "";
        forEachElem(this.Variables, va => {
            v += va.toXML() + "\n";
        });

        return `<GlobalVars>
        ${v}
        </GlobalVars>`;
    }

}

/**
 * Represents a task in the IEC file.
 */
export class Task extends Serializable{
    /**
     * Constructs a new Task object.
     * @param {string?} type The type of the task.
     * @param {string?} name The name of the task.
     * @param {string?} interval The interval at which the task runs.
     * @param {string?} priority The priority of the task.
     * @param {Configuration?} parent The parent that owns the task.
     */
    constructor(type, name, interval, priority, parent){
        super();
        this.TypeMap = {
            "Type": "",
            "Name": "",
            "Interval": "",
            "Priority": ""
        };
        this.Type = "";
        this.Name = "";
        this.Interval = "1000";
        this.Priority = "1";
        this.Parent = null;
        if(isValid(type)) this.Type = type;
        if(isValid(name)) this.Name = name;
        if(isValid(interval)) this.Interval = interval;
        if(isValid(priority)) this.Priority = priority;
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates a new task object from xml.
     * @param {Element} xml The xml element from which to create the object.
     * @param {Configuration?} parent The parent that owns the object.
     * @returns {Task} Returns a new task object.
     */
    static fromXML(xml, parent){
        if(!isValid(xml)) return null;
        return new Task(xml.getAttribute("xsi:type"), xml.getAttribute("name"), xml.getAttribute("interval"), xml.getAttribute("priority"), parent);
    }

    /**
     * Creates a xml string representation of the object.
     * @returns {string} Returns an xml string of the object.
     */
    toXML(){
        return `<Task xsi:type="${this.Type}" name="${this.Name}" interval="${this.Interval}" priority="${this.Priority}"/>`;
    }

    /**
     * Converts the task information to a structured text comment containing JSON that can be consumed by a compiler
     * for creating platform specific tasks.
     * @returns {string} A string representing the task as structured text.
     */
    toST(){
        return `//Task={"Name":"${this.Name}", "Interval":"${this.Interval}", "Priority":"${this.Priority}"}\n`;
    }
}

/**
 * Represents a ProgramInstance in the IEC file.
 */
export class ProgramInstance extends Serializable{
    /**
     * Constructs a new ProgramInstance object.
     * @param {string?} name The name of the instance.
     * @param {string?} typeName The type name for the instance.
     * @param {string?} associatedTaskName The task associated with this instance.
     * @param {Configuration?} parent The parent that owns this object.
     */
    constructor(name, typeName, associatedTaskName, parent){
        super();
        this.TypeMap = {
            "Name": "",
            "TypeName": "",
            "AssociatedTaskName": ""
        };
        this.TypeName = "";
        this.Name = "";
        this.AssociatedTaskName = "";
        this.Parent = null;
        if(isValid(typeName)) this.TypeName = typeName;
        if(isValid(name)) this.Name = name;
        if(isValid(associatedTaskName)) this.AssociatedTaskName = associatedTaskName;
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates a new ProgramInstance object from the xml element.
     * @param {Element} xml The xml element from which to create the object.
     * @param {Configuration?} parent The parent that owns the objec.t
     * @returns {ProgramInstance?} Returns a new object.
     */
    static fromXML(xml, parent){
        if(!isValid(xml)) return null;
        return new ProgramInstance(xml.getAttribute("name"), xml.getAttribute("typeName"), xml.getAttribute("associatedTaskName"), parent);
    }

    /**
     * 
     * @returns {string} An xml string representing the object.
     */
    toXML(){
        return `<ProgramInstance typeName="${this.TypeName}" name="${this.Name}" associatedTaskName="${this.AssociatedTaskName}"/>`;
    }

    /**
     * Creates a structured text comment containing JSON that represents the properties of the instance, which can be consumed by
     * compilers to set up platform-specific instances.
     * @returns {string} Returns a string representing the structured Text.
     */
    toST(){
        return `//Instance={"TypeName":"${this.TypeName}", "Name":"${this.Name}", "AssociatedTaskName":"${this.AssociatedTaskName}"}\n`;
    }
}

/**
 * Represents the Program element of the IEC project file.
 */
export class Program extends Serializable {
    /**
     * 
     * @param {string?} name Can be null or undefined.
     * @param {ExternalVars?} externalVars can be null or undefined.
     * @param {Vars?} vars can be null or undefined.
     * @param {MainBody?} mainBody Can be null or undefined.
     * @param {NamespaceDecl?} parent The containing namespace.
     */
    constructor(name, externalVars, vars, mainBody, parent) {
        super();
        this.TypeMap = {
            "Name": "",
            "ExternalVars": ExternalVars,
            "Vars": Vars,
            "MainBody": MainBody,
        };
        this.Name = "";
        this.ExternalVars = new ExternalVars();
        this.Vars = new Vars();
        this.MainBody = new MainBody();
        this.Parent = null;
        if(isValid(name)) this.Name = name;
        if(isValid(externalVars)) this.ExternalVars = externalVars;
        if(isValid(vars)) this.Vars = vars;
        if(isValid(mainBody)) this.MainBody = mainBody;
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates a new Program object based on an XML element.
     * @param {Element} xml The XML element to create from.
     * @param {NamespaceDecl} parent The containing namespace.
     * @returns A new Program object.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) return null;
        const prog = new Program(
            xml.getAttribute("name"),
            ExternalVars.fromXML(xml.getElementsByTagName("ExternalVars")[0]),
            Vars.fromXML(xml.getElementsByTagName("Vars")[0]),
            null, parent
        );
        prog.MainBody = MainBody.fromXML(xml.getElementsByTagName("MainBody")[0], prog);
        return prog;
    }

    /**
     * 
     * @returns Returns an xml string representing the object.
     */
    toXML() {
        return `<Program name="${this.Name}">
                    ${this.ExternalVars.toXML()}
                    ${this.Vars.toXML()}
                    ${this.MainBody.toXML()}
                </Program>`;
    }

    /**
     * Compiles the program as structured text. NOTE: external variables are ignored and should be
     * defined in the resource section of the project as global variables.
     * @returns {string} Returns a string representing the structured text of the program.
     */
    toST(){
        var st = "";
        try{
            var decl = "";
            forEachElem(this.Vars.Variables, 
                /**
                 * 
                 * @param {Variable} v 
                 */
                (v) => {
                    decl += `${v.Name} ${isValid(v.Address) ? "%" + v.Address.Location + v.Address.Size + (v.Address.Address.length > 0 ? "." + v.Address.Address : "") : ""} : ${v.Type.TypeName};\n`;
                }
            );
            st = 
`PROGRAM ${this.Name}
    VAR
        ${decl}
    END_VAR
    ${this.MainBody.toST()}
END_PROGRAM`;
        }
        catch(e){
            console.error(e);
        }
        return st;
    }
}

/**
 * Represents a MainBody element in the IEC project file.
 */
export class MainBody extends Serializable{
     /**
      * Constructs a new MainBody object.
      * @param {BodyContent?} bodyContent Can be null or undefined.
      * @param {Program|FunctionBlock?} parent The containing object for this one.
      */
    constructor(bodyContent, parent) {
        super();
        this.TypeMap = {
            "BodyContent": BodyContent
        };
        this.BodyContent = new BodyContent();
        this.Parent = null;
        if(isValid(bodyContent)) this.BodyContent = bodyContent;
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates a new MainBody object from an xml element.
     * @param {Element} xml The XML element object from which to create an object.
     * @param {Program|FunctionBlock?} parent The containing object for this one.
     * @returns {MainBody} A new MainBody object.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) return null;
        const body = new MainBody( null , parent);
        body.BodyContent = BodyContent.fromXML(xml.getElementsByTagName("BodyContent")[0], body);
        return body;
    }

    /**
     * 
     * @returns {string} Returns a string of xml representing htis object.
     */
    toXML() {
        return `<MainBody>
                    ${this.BodyContent.toXML()}
                </MainBody>`;
    }

    /**
     * Converts the content of this body to structured text.
     * @returns {string} Returns a string representing the structured text.
     */
    toST(){
        return this.BodyContent.toST();
    }
}

/**
 * Represents a BodyContent element in an IEC project file.
 */
export class BodyContent extends Serializable {
    /**
     * Constructs a new BodyContent object
     * @param {string?} type The type of body content. Default: ST
     * @param {ST?} st An ST object, can be null or undefined.
     * @param {Rung[]?} rungs An array of Rung objects. Can be null or undefined.
     * @param {Network[]?} networks An array of network objects. Can be null or undefined.
     * @param {MainBody?} parent The Mainbody object that contains this content
     */
    constructor(type, st, rungs, networks, parent) {
        super();
        this.TypeMap = {
            "Type": "",
            "ST": ST,
            "Rungs": [],
            "Networks": []
        };
        this.Type = "ST";
        if(isValid(type)) this.Type = type;
        this.ST = null;
        this.Rungs = [];
        this.Networks = [];
        this.Parent = null;
        if(type == "ST"){
            this.ST = new ST();
            if(isValid(st)) this.ST = st;
        }
        else if(type == "LD"){
            if(isValid(rungs)) this.Rungs = rungs;
        }
        else if(type == "FBD"){
            if(isValid(networks)) this.Networks = networks;
        }
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates a new BodyContent object based on an XML element.
     * @param {Element} xml An XML element object.
     * @param {MainBody?} parent The parent of this object.
     * @returns {BodyContent} Returns a new BodyContent object.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) return null;
        var b = new BodyContent(
            xml.getAttribute("xsi:type"), null, null, null, parent);
        var xmlrungs = xml.getElementsByTagName("Rung");
        var xmlnet = xml.getElementsByTagName("Network");
        var xmlst = xml.getElementsByTagName("ST")[0];
        if(b.Type == "ST"){
            b.ST = ST.fromXML(xmlst);
            if(!isValid(b.ST)){
                b.ST = new ST();
            }
        }
        else if(b.Type == "LD"){
            forEachElem(xmlrungs, (elem) => {
                b.Rungs.push(Rung.fromXML(elem, b));
            });
        }
        else if(b.Type == "FBD"){
            forEachElem(xmlnet, (elem) => {
                b.Networks.push(Network.fromXML(elem, b));
            });
        }

        return b;
    }

    /**
     * 
     * @returns Returns an xml string representing the object.
     */
    toXML() {
        var subxml = "";
        if(this.Type == "ST"){
            if(isValid(this.ST)){
                subxml = this.ST.toXML();
            }
        }
        else if(this.Type == "LD"){
            if(isValid(this.Rungs)){
                forEachElem(this.Rungs, (rung) => {
                    subxml += rung.toXML() + "\n";
                });
            }
        }
        else if(this.Type == "FBD"){
            if(isValid(this.Networks)){
                forEachElem(this.Networks, (net) => {
                    subxml += net.toXML() + "\n";
                });
            }
        }
        return `<BodyContent xsi:type="${this.Type}">
                    ${subxml}
                </BodyContent>`;
    }

    /**
     * Finds an object in the rungs based on the ID value.
     * @param {string} id The ID value for the object.
     * @returns {FbdObject|LdObject?} Returns the object matching the ID, or null if no match.
     */
    findObject(id){
        var ret = null;
        try{
            forEachElem(this.Rungs, (r) => {
                if(isValid(ret)){
                    return;
                }
                ret = r.findObject(id);
            });
        }
        catch(e){
            console.error(e);
        }
        return ret;
    }

    /**
     * Converts the content to structured text.
     * @returns {string} Returns a string representing the structured text.
     */
    toST(){
        var st = "";
        try{
            if(this.Type ==="LD"){
                this.Rungs.sort((r1, r2) => parseInt(r1.EvaluationOrder) - parseInt(r2.EvaluationOrder));
                forEachElem(this.Rungs, r => {
                    st += r.toST();
                });
            }
            else if(this.ST !== null){
                st = this.ST.Content.trim();
            }
        }
        catch(e){
            console.error(e);
        }
        return st;
        
    }
}

/**
 * Represents a Structured Text (ST) element in the IEC project file.
 */
export class ST extends Serializable{
    /**
     * Constructs a new ST object with content.
     * @param {string?} content The content of the code, or null or undefined.
     */
    constructor(content) {
        super();
        this.TypeMap = {
            "Content": ""
        };
        this.Content = "";

        if(isValid(content)) this.Content = content;
    }

    /**
     * Creates an ST object based on an XML element.
     * @param {Element} xml The element from which to create the object.
     * @returns {ST} A new ST object.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        return new ST(
            xml.textContent.trim()
        );
    }

    /**
     * 
     * @returns {string} An XML string representing the object.
     */
    toXML() {
        return `<ST><![CDATA[${this.Content}]]></ST>`;
    }
}

/**
 * Represents a FunctionBlack element of the IEC Project File.
 */
export class FunctionBlock extends Serializable{
    /**
     * Constructs a new FunctionBlock object based on the arguments
     * @param {string} name The name of the function block.
     * @param {Parameters} parameters The parameters for the function block.
     * @param {Vars} vars The variables within the function block.
     * @param {MainBody} mainBody The main body of the block.
     * @param {NamespaceDecl} parent The parent that owns the block.
     */
    constructor(name, parameters, vars, mainBody, parent) {
        super();
        this.TypeMap = {
            "Name": "",
            "Parameters": Parameters,
            "Vars": Vars,
            "MainBody": MainBody
        };
        this.Parent = null;
        this.Name = "";
        this.Parameters = new Parameters();
        this.Vars = new Vars();
        this.MainBody = new MainBody();
        if(isValid(name)) this.Name = name;
        if(isValid(parameters)) this.Parameters = parameters;
        if(isValid(vars)) this.Vars = vars;
        if(isValid(mainBody)) this.MainBody = mainBody;
        if(isValid(parent)) this.Parent = parent;
    }
    /**
     * Creates a new FunctionBlock object based on an xml element.
     * @param {Element} xml The XML to create the FunctionBlock from.
     * @param {NamespaceDecl} parent The parent that owns the object.
     * @returns {FunctionBlock} Returns a new FunctionBlock object.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) return null;
        var obj = new FunctionBlock(xml.getAttribute("name"), null, null, null, parent);
        obj.Parameters = Parameters.fromXML(xml.getElementsByTagName("Parameters")[0]);
        obj.Vars = Vars.fromXML(xml.getElementsByTagName("Vars")[0]);
        obj.MainBody = MainBody.fromXML(xml.getElementsByTagName("MainBody")[0], obj);
        return obj;
    }
    /**
     * 
     * @returns {string} Returns an XML string representing the object.
     */
    toXML() {
        return `<FunctionBlock name="${this.Name}">
                    ${this.Parameters.toXML()}
                    ${this.Vars.toXML()}
                    ${this.MainBody.toXML()}
                </FunctionBlock>`;
    }

    /**
     * Compiles the function block as structured text.
     * @returns {string} Returns a string representing the structured text.
     */
    toST(){
        var st = "";
        try{
            var decl = "";
            var inputs = "";
            var outputs = "";
            this.Parameters.InputVars.Variables.sort((a, b) => parseInt(a.Order) - parseInt(b.Order));
            this.Parameters.OutputVars.Variables.sort((a, b) => parseInt(a.Order) - parseInt(b.Order));
            forEachElem(this.Parameters.InputVars.Variables, 
                /**
                 * 
                 * @param {Variable} v 
                 */
                (v) => {
                    inputs += `${v.Name} : ${v.Type.TypeName};\n`;
                }
            );
            forEachElem(this.Parameters.OutputVars.Variables, 
                /**
                 * 
                 * @param {Variable} v 
                 */
                (v) => {
                    outputs += `${v.Name} : ${v.Type.TypeName};\n`;
                }
            );
            forEachElem(this.Vars.Variables, 
                /**
                 * 
                 * @param {Variable} v 
                 */
                (v) => {
                    decl += `${v.Name} ${isValid(v.Address) ? "%" + v.Address.Location + v.Address.Size + (v.Address.Address.length > 0 ? "." + v.Address.Address : "") : ""} : ${v.Type.TypeName};\n`;
                }
            );
            st =
`FUNCTION_BLOCK ${this.Name}
    VAR_INPUT
        ${inputs}
    END_VAR
    VAR_OUTPUT
        ${outputs}
    END_VAR
    VAR
        ${decl}
    END_VAR
    ${this.MainBody.toST()}
END_FUNCTION_BLOCK`;
        }
        catch(e){
            console.error(e);
        }
        return st;
    }
}

/**
 * Represents the Rung element of an IEC project file.
 */
export class Rung extends Serializable {
    /**
     * Constructs a new Rung object.
     * @param {string?} evaluationOrder The order of eval for this rung.
     * @param {BodyContent?} parent The containing BodyContent object for this rung.
     */
    constructor(evaluationOrder, parent) {
        super();
        this.TypeMap = {
            "EvaluationOrder": "",
            "Objects": []
        };
        this.EvaluationOrder = "";
        this.Objects = [];
        this.Parent = null;
        if(isValid(evaluationOrder)) this.EvaluationOrder = evaluationOrder;
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates a new Rung object based on an XML element.
     * @param {Element} xml The XML element from which to create the Rung.
     * @param {BodyContent?} parent The containing bodycontent for this rung.
     * @returns {Rung} A new rung object.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) return null;
        var rung = new Rung(xml.getAttribute("evaluationOrder"), parent);
        var lnodes = xml.getElementsByTagName("LdObject");
        var fnodes = xml.getElementsByTagName("FbdObject");
        forEachElem(lnodes, (elem) => {
            if(elem.tagName == "LdObject"){
                rung.Objects.push(LdObject.fromXML(elem, rung));
            }
        });
        forEachElem(fnodes, (elem) => {
            if(elem.tagName == "FbdObject"){
                rung.Objects.push(FbdObject.fromXML(elem, rung));
            }
        })
        return rung;
    }

    /**
     * 
     * @returns {string} Returns a string of xml representing the object.
     */
    toXML() {
        var objxml = "";
        forEachElem(this.Objects, (obj) => {
            objxml += obj.toXML() + "\n";
        });
        return `<Rung evaluationOrder="${this.EvaluationOrder}">
                    ${objxml}
                </Rung>`;
    }

    /**
     * Creates a new rung and adds the left and right power rails.
     * @param {string} order The evaluation order for this rung.
     * @param {BodyContent?} parent The body content containing this rung. 
     * @returns 
     */
    static createRung(order, parent){
        var rung = new Rung(order, parent);
        rung.addObject(LdObject.createPowerRail("1", true, rung));
        rung.addObject(LdObject.createPowerRail("256", false, rung));
        //rung.Objects[1].connectTo("1");
        return rung;
    }

    /**
     * Adds an object to the rung.
     * @param {FbdObject|LdObject|CommonObject} newobj The object to add to the rung.
     * @param {string} refID The Id of the output point to which this object should be connected.
     * @param {string} connectionVar The input variable name to which the output should be connected.
     * @returns {boolean} Returns true if the object was added.
     */
    addObject(newobj, refID="", connectionVar=""){
        var retval = true;
        try{
            if(this.Objects.findIndex((elem) => {newobj === elem;}) == -1){
                this.Objects.push(newobj);
                if(refID.length > 0){
                    newobj.connectTo(refID, connectionVar);
                }
            }
            else{
                retval = false;
            }
        }
        catch(e){
            retval = false;
            console.error(e);
        }
        return retval;
    }

    /**
     * Removes an object from the rung.
     * @param {LdObject|FbdObject|CommonObject} obj The object to remove.
     * @returns {boolean} True if it successfully removed the object.
     */
    removeObject(obj){
        var retval = true;
        try{
            let i = this.Objects.findIndex((elem) => elem === obj);
            if(i > -1){
                if(i > 0 && obj.Type !== "RightPowerRail"){
                    //get all objects connected to this one and reassign their connections to this object's input.
                    var outcons = this.findConnectedOutputs(obj);
                    var incons = this.findConnectedInputs(obj);

                    if(outcons.length > 0){
                        if(incons.length >0){
                            forEachElem(outcons, (con) => {
                                con.RefID = incons[0].RefID;
                            });
                        }
                    }
                    
                    this.Objects.splice(i, 1);
                }
            }
            else{
                retval = false;
            }
        }
        catch(e){
            console.error(e);
            retval = false;
        }
        return retval;
    }

    /**
     * Finds an object in the rung based on its unique ID value.
     * @param {string} id The ID value for the object.
     * @returns {FbdObject|LdObject|CommonObject} Returns the object that matches the ID, or null if no object matches.
     */
    findObject(id){
        return this.Objects.find((v) => v.ID == id);
    }

    /**
     * 
     * @param {LdObject | FbdObject} obj The ladder logic object from which to find connections.
     * @param {boolean} outputs Determines whether to search for objects that are connected to this object's outputs or inputs.
     * If true, it searches for output connections. If false, it searches for inputs. Default is true;
     * @returns {FbdObject[]|LdObject[]|CommonObject[]} Returns an array of objects.
     */
    findConnections(obj, outputs=true){
        var retval = [];
        try{
            if(outputs){
                forEachElem(obj.Outputs, (point) => {
                    forEachElem(this.Objects, (o) => {
                        if(o.isConnectedTo(point.ID)){
                            if(!retval.includes(o)) retval.push(o);
                        }
                    });
                    
                });
                if(obj instanceof FbdObject){
                    forEachElem(obj.OutputVariables.Variables, (v) => {
                        forEachElem(this.Objects, (o) => {
                            if(o.isConnectedTo(v.OutputPoint.ID)){
                                if(!retval.includes(o)) retval.push(o);
                            }
                        });
                    });
                }
            }
            else{
                forEachElem(obj.Inputs, (point) => {
                    if(point.Connections.length > 0){
                        forEachElem(this.Objects, (o) => {
                            forEachElem(point.Connections, (c) => {
                                if(o.hasOutput(c.RefID)){
                                    if(!retval.includes(o)) retval.push(o);
                                }
                            });
                            
                        });
                    }
                });
                if(obj instanceof FbdObject){
                    forEachElem(obj.InputVariables.Variables, (v) => {
                        forEachElem(this.Objects, (o) => {
                            if(v.InputPoint.Connections.length > 0){
                                forEachElem(v.InputPoint.Connections, (c) => {
                                    if(o.hasOutput(c.RefID)){
                                        if(!retval.includes(o)) retval.push(o);
                                    }
                                });
                                
                            }
                            
                        });
                    });
                }
            }
            
            
        }
        catch(e){

        }
        return retval;
    }

    /**
     * Finds all input points that are connected to the given object's outputs.
     * @param {FbdObject | LdObject} obj the ladder logic object from which to search for connected outputs.
     * @returns {Connection[]} An array of Connection objects from the ConnectionPointIns in the objects that are connected to this object's output points.
     */
    findConnectedOutputs(obj){
        var retval = [];
        try{
            forEachElem(obj.Outputs, (point) => {
                forEachElem(this.Objects, (o) => {
                    forEachElem(o.Inputs, (input) => {
                        if(isValid(input.Connection)){
                            if(input.Connection.RefID == point.ID){
                                retval.push(input.Connection);
                            }
                        }
                    });
                });
                
            });
            if(obj === FbdObject){
                forEachElem(obj.OutputVariables.Variables, (v) => {
                    forEachElem(this.Objects, (o) => {
                        forEachElem(o.InputVariables.Variables, (invar) => {
                            if(isValid(invar.InputPoint.Connection)){
                                if(invar.InputPoint.Connection.RefID == v.OutputPoint.ID){
                                    retval.push(invar.InputPoint.Connection);
                                }
                            }
                        });
                    });
                });
            }
        }
        catch(e){
            console.error(e);
        }
        return retval;
    }

    /**
     * Finds all inputs into this object that have connections.
     * @param {FbdObject | LdObject} obj The ladder logic object from which to search for connected inputs.
     * @returns {Connection[]} An array of connection objects from the ConnectionPointIns in this object.
     */
    findConnectedInputs(obj){
        var retval = [];
        try{
            forEachElem(obj.Inputs, (point) => {
                if(isValid(point.Connection)){
                    retval.push(point.Connection);
                }
            });

            if(obj instanceof FbdObject){
                forEachElem(obj.InputVariables.Variables, (v) => {
                    if(isValid(v.InputPoint.Connection)){
                        retval.push(v.InputPoint.Connection);
                    }
                });
            }
        }
        catch(e){

        }
        return retval;
    }

    /**
     * Finds the greatest output ID.
     * @returns {number} The greatest output ID value.
     */
    findLastOutputID(){
        var ret = 0;
        try{
            forEachElem(this.Objects, (o) => {
                forEachElem(o.Outputs, (c) => {
                    var n = parseInt(c.ID);
                    if(n > ret) ret = n;
                });

                if(o instanceof FbdObject){
                    forEachElem(o.OutputVariables.Variables, (v) => {
                        var n = parseInt(v.OutputPoint.ID);
                        if(n > ret) ret = n;
                    });
                }
            });
        }
        catch(e){

        }
        return ret;
    }

    /**
     * Gets the objects of certain types arranged by their output IDs.
     * @param {string[]} types An array of "Type" values to look for.
     */
    objectsByOutput(types){
        var objs = new Array(this.findLastOutputID() + 1);
        objs = objs.fill(null);
        forEachElem(this.Objects, (elem) => {
            var i = 0;
            for(i = 0; i < elem.Outputs.length; i++){
                var id = parseInt(elem.Outputs[i].ID);
                if(!isValid(types)){
                    objs[id] = elem;
                }
                else if(types.includes(elem.Type)){
                    objs[id] = elem;
                }   
            }
            if(elem instanceof FbdObject){
                forEachElem(elem.OutputVariables.Variables, (v) => {
                    var id = parseInt(v.OutputPoint.ID);
                    if(!isValid(types)){
                        objs[id] = elem;
                    }
                    else if(types.includes(elem.Type)){
                        objs[id] = elem;
                    }  
                });
            }
        });
        return objs;
    }

    /**
     * Finds the objects based on the inputs.
     * @param {string[]} types A list of "Type" names to find.
     * @returns {FbdObject[]|LdObject[]} The objects by input ID.
     */
    objectsWithInputs(types){
        var objs = [];
        forEachElem(this.Objects, (elem) => {
            var i = 0;
            if(elem.Inputs.length > 0){
                if(!isValid(types)){
                    objs.push(elem);
                }
                else if(types.includes(elem.Type)){
                    objs.push(elem);
                }
            }
            if( elem instanceof FbdObject){
                forEachElem(elem.InputVariables.Variables, (v) => {
                    if(v.InputPoint != null){
                        if(!isValid(types)){
                            objs.push(elem);
                        }
                        else if(types.includes(elem.Type)){
                            objs.push(elem);
                        }
                    }  
                });
            }
        });
        return objs;
    }

    #buildExpression(start){
        var expression = "";
        forEachElem(this.findConnections(start, false), 
            /**
             * 
             * @param {LdObject | FbdObject} con 
             */
            (con) => {
                if(expression.length > 0){
                    expression += " OR ";
                }
                if(con instanceof FbdObject){
                    var v = con.OutputVariables.Variables.find(iv => start.hasInput(iv.OutputPoint.ID));
                    if(isValid(v)){
                        expression += con.toST(v.ParameterName);
                    }
                }
                else if(con.Type !== "LeftPowerRail"){
                    expression += `(${this.#buildExpression(con)})`;
                }
            }
        );
        if(start.Type !== "Coil"){
            expression = `${start.toST()}${expression.length > 0 ? " AND (" + expression + ")" : ""}`;
        }
        return expression;  
    }

    /**
     * Builds a string of structured text for the entire rung
     * @returns {string} Returns a string representing the structured text for this rung.
     */
    toST(){
        var st = "";
        try{
            //1) get the DataSources and Sinks and create their assignments.
            //1a) Create expressions for setting the Block object inputs.
            //2) Get all the coils, for each coil, we...
            //2a) Get all objects for its inputs, if there are multiple inputs, we begin an OR statement with the return of the recursive call to toST on each object.
            //2b) If there is only one input, we call the toST on that object and AND it with the recursive call to this toST
            //2c) If we hit Left Rail, we call toST on the coil, passing it the resulting expression from all the inputs.
            var objs = this.objectsWithInputs(["Block"]);
            var done = [];
            forEachElem(objs, 
                /**
                 * 
                 * @param {FbdObject} block 
                 */
                (block) => {
                    if(done.includes(block.ID)) return;
                    done.push(block.ID);
                    forEachElem(block.InputVariables.Variables, 
                        /**
                         * 
                         * @param {InputVariable} invar 
                         */
                        (invar) => {
                            forEachElem(invar.InputPoint.Connections, (c) => {
                                /**
                                 * @type {FbdObject}
                                 */
                                var inobj = this.Objects.find(o => o.hasOutput(c.RefID));
                                if(isValid(inobj)){
                                    if(inobj.Type === "DataSource"){
                                        st += block.toST(invar.ParameterName, inobj.toST()) + ";\n";
                                    }
                                    else{
                                        st += block.toST(invar.ParameterName, this.#buildExpression(inobj)) + ";\n";
                                    }
                                }
                            });
                        }
                    );
                    forEachElem(block.OutputVariables.Variables, 
                            /**
                         * 
                         * @param {OutputVariable} outvar 
                         */
                        (outvar) => {
                            
                            
                            var inobj = this.Objects.find(o => o.hasInput(outvar.OutputPoint.ID));
                            if(isValid(inobj)){
                                if(inobj.Type === "DataSink"){
                                    st += inobj.toST(outvar.ParameterName, block.toST(outvar.ParameterName)) + ";\n";
                                }
                            }
                            
                        }
                    );
                }
            );

            objs = this.objectsWithInputs(["Coil"]);
            forEachElem(objs, 
                /**
                 * 
                 * @param {LdObject} coil 
                 */
                (coil) => {
                    st += coil.toST(this.#buildExpression(coil)) + ";\n";
                    
                }
            );
            
            
        }
        catch(e){
            console.error(e);
        }
        return st;
    }
}

/**
 * Represents a Network element in an IEC project file.
 */
export class Network extends Serializable{
    /**
     * Constructs a new Network object.
     * @param {string} evaluationOrder 
     */
    constructor(evaluationOrder, parent) {
        super();
        this.TypeMap = {
            "EvaluationOrder": "",
            "Objects": []
        };
        this.EvaluationOrder = "";
        this.Parent = null;
        this.Objects = [];
        if(isValid(evaluationOrder)) this.EvaluationOrder = evaluationOrder;
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates a new Network object based on the xml element.
     * @param {Element} xml The XML element from which to create the object.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) return null;
        var net = new Network(xml.getAttribute("evaluationOrder"), parent);
        var onodes = xml.getElementsByTagName("CommonObject,FbdObject");
        forEachElem(onodes, (elem) => {
            if(elem.tagName == "CommonObject"){
                net.Objects.push(CommonObject.fromXML(elem, net));
            }
            else if(elem.tagName == "FbdObject"){
                net.Objects.push(FbdObject.fromXML(elem, net));
            }
        });
    }

    /**
     * 
     * @returns Returns an xml string representing the object.
     */
    toXML() {
        var objxml = "";
        forEachElem(this.Objects, (obj) => {
            objxml += obj.toXML() + "\n";
        });
        return `<Network xsi:type="FbdNetwork" evaluationOrder="${this.EvaluationOrder}" >
                    ${objxml}
                </Network>`;
    }
}

/**
 * Represents a Ladder Logic Object in the IEC Project file.
 */
export class LdObject extends Serializable{
    /**
     * Constructs a new LdObject object.
     * @param {string?} type The type of object, or null/undefined.
     * @param {string?} operand The operand for the object., or null/undefined.
     * @param {string?} operand1 When type is a "CompareContact", this is the first operand of the compare.
     * @param {string?} operand2 when type is a "CompareContact", this is the second operand of the compare.
     * @param {string?} negated Should be a string of "true" or "false", determining whether the contact/coil is negated.
     * @param {string?} latch Specifies the type of latch for the coil. Defaults to "none".
     * @param {string?} edge Determines the edge of the contact. Defaults to none.
     * @param {string?} operator Designates the "compareOperator" option for a CompareContact type.
     * @param {RelPosition?} relPosition The relative position for the LdObject
     * @param {Rung?} parent The rung that this object is part of.
     */
    constructor(type, operand, operand1, operand2, negated, latch, edge, operator, relPosition, parent) {
        super();
        this.TypeMap = {
            "Type": "",
            "Operand": "",
            "Operand1": "",
            "Operand2": "",
            "Negated": "",
            "Latch": "",
            "Edge": "",
            "Operator": "",
            "RelPosition": RelPosition,
            "Inputs": [],
            "Outputs": []
        };
        this.ID = generateGUID();
        this.Type = "Contact";
        this.Operand = "";
        this.Operand1 = "";
        this.Operand2 = "";
        this.Negated = "false";
        this.Latch = "none";
        this.Edge = "none";
        this.Operator = "";
        this.Parent = null;
        this.RelPosition = new RelPosition(0, 0);
        if(isValid(type)) this.Type = type;
        if(isValid(operand)) this.Operand = operand;
        if(isValid(operand1)) this.Operand1 = operand1;
        if(isValid(operand2)) this.Operand2 = operand2;
        if(isValid(negated)) this.Negated = negated;
        if(isValid(latch)) this.Latch = latch;
        if(isValid(edge)) this.Edge = edge;
        if(isValid(operator)) this.Operator = operator;
        if(isValid(parent)) this.Parent = parent;
        if(isValid(relPosition)) this.RelPosition = relPosition;
        this.Inputs = [];
        this.Outputs = [];
    }

    /**
     * creates a new LdObject object from an xml element.
     * @param {Element} xml The element representing the XML.
     * @param {Rung} [parent=null] The rung that this object is part of.
     * @returns a new LdObject object.
     */
    static fromXML(xml, parent=null) {
        if(!isValid(xml)) return null;
        var obj = new LdObject(
            xml.getAttribute("xsi:type"),
            xml.getAttribute("operand"),
            xml.getAttribute("operand1"),
            xml.getAttribute("operand2"),
            xml.getAttribute("negated"),
            xml.getAttribute("latch"),
            xml.getAttribute("edge"),
            xml.getAttribute("compareOperator"),
            RelPosition.fromXML(xml.getElementsByTagName("RelPosition")[0]),
            parent
        );
        var ins = xml.getElementsByTagName("ConnectionPointIn");
        var outs = xml.getElementsByTagName("ConnectionPointOut");
        forEachElem(ins, (elem) => {
            obj.Inputs.push(ConnectionPointIn.fromXML(elem));
        });
        forEachElem(outs, (elem) => {
            obj.Outputs.push(ConnectionPointOut.fromXML(elem));
        });
        return obj;
    }

    /**
     * 
     * @returns Returns an xml string representing the object.
     */
    toXML() {
        var conxml = "";
        forEachElem(this.Inputs, (elem) => {
            conxml += elem.toXML() + "\n";
        });
        forEachElem(this.Outputs, (elem) => {
            conxml += elem.toXML() + "\n";
        });
        var attribs = "";
        if(this.Operand.length > 0){
            attribs += ` operand="${this.Operand}"`;
        }
        if(this.Operand1.length > 0){
            attribs += ` operand1="${this.Operand1}"`;
        }
        if(this.Operand2.length > 0){
            attribs += ` operand2="${this.Operand2}"`;
        }
        if(this.Edge.length > 0){
            attribs += ` edge="${this.Edge}"`;
        }
        if(this.Negated.length > 0){
            attribs += ` negated="${this.Negated}"`;
        }
        if(this.Latch.length > 0){
            attribs += ` latch="${this.Latch}"`;
        }
        if(this.Operator.length > 0){
            attribs += ` compareOperator="${this.Operator}"`;
        }

        return `<LdObject xsi:type="${this.Type}" ${attribs}>
                    ${this.RelPosition.toXML()}
                    ${conxml}
                </LdObject>`;
    }

    /**
     * Helper function to create a power rail object.
     * @param {string} outID The output ID of the rail, if left rail.
     * @param {boolean} left Indicates whether to create a left or right rail.
     * @param {Rung} parent The rung to which the rail should be added.
     * @returns {LdObject} The rail object.
     */
    static createPowerRail(outID, left=true, parent=null){
        var rail = null;
        if(!left){
            rail = new LdObject("RightPowerRail", "","","","","","","", null, parent);
            rail.Inputs.push(new ConnectionPointIn());
        }
        else{
            rail = new LdObject("LeftPowerRail", parent.EvaluationOrder,"","","","","","", null, parent);
            rail.Outputs.push(new ConnectionPointOut(outID));
        }
        return rail;
    }

    /**
     * Helper function to create a contact object.
     * @param {string} operand The operand for the contact.
     * @param {string} outID The ID for the output point.
     * @param {string} negated The negation of the contact.
     * @param {string} edge The edge of the contact.
     * @param {Rung} parent The rung that is the parent.
     * @returns {LdObject} A new contact object.
     */
    static createContact(operand, outID, negated="false", edge="none", parent=null){
        var contact = new LdObject("Contact", operand, "", "", negated, "", edge, "", null, parent);
        contact.Inputs.push(new ConnectionPointIn());
        contact.Outputs.push(new ConnectionPointOut(outID));
        return contact;
    }
    /**
     * Helper function to create a new compare contact object.
     * @param {string} operand1 The first operand of the compare.
     * @param {string} operand2 The second operand of the compare.
     * @param {string} operator The operator for the compare.
     * @param {string} outID The output ID of the object.
     * @param {Rung} parent The rung that will be its parent.
     * @returns {LdObject} The compare contact object.
     */
    static createCompareContact(operand1, operand2, operator, outID, parent=null){
        var contact = new LdObject("CompareContact", "", operand1, operand2, "", "", "", operator, null, parent);
        contact.Inputs.push(new ConnectionPointIn());
        contact.Outputs.push(new ConnectionPointOut(outID));
        return contact;
    }
    /**
     * Helper function to create a new coil object.
     * @param {string} operand The operand for the coil.
     * @param {string} outID The output ID for the coil.
     * @param {string} negated The nagation state.
     * @param {string} latch The latch state.
     * @param {string} edge The edge of the coil.
     * @param {Rung} parent The rung that is the parent.
     * @returns {LdObject} A new coil object.
     */
    static createCoil(operand, outID, negated="false", latch="none", edge="none", parent=null){
        var coil = new LdObject("Coil", operand, "", "", negated, latch, edge, "", null, parent);
        coil.Inputs.push(new ConnectionPointIn());
        coil.Outputs.push(new ConnectionPointOut(outID));
        return coil;
    }

    /**
     * Checks to see if an output point is connected to this object.
     * @param {string} refOutID The output ID to look for.
     * @returns {boolean} Returns true if the object is connected to the given output point ID.
     */
    isConnectedTo(refOutID){
        var retval = false;
        try{
            forEachElem(this.Inputs, (point) => {
                if(retval) return;
                if(point.isConnectedTo(refOutID)){
                    retval = true;
                }
            });
        }
        catch(e){
            console.error(e);
        }
        return retval;
    }

    /**
     * Connects this object to an output point.
     * @param {string} outID The output point ID to connect to.
     * @param {string} invar Not used on this class.
     */
    connectTo(outID, invar=""){
        try{
            var connected = false;
            forEachElem(this.Inputs, (point) => {
                if(connected) return;
                if(point.isConnectedTo(outID)){
                    connected = true;
                }
                else{
                    point.connectTo(outID);
                    connected = true;
                }
            });
        }
        catch(e){
            console.error(e);
        }
    }

    /**
     * Disconnects the object from an output point.
     * @param {string} outID The ID of the output point.
     */
    disconnect(outID){
        var found = false;
        forEachElem(this.Inputs, (point) => {
            if(found) return;
            if(point.isConnectedTo(outID)){
                point.disconnect(outID);
                found = true;
            }
        });
    }

    /**
     * Gets the output IDs for this object.
     * @returns {string[]} Returns an array of output IDs on this object.
     */
    getOutputIDs(){
        var results = [];
        forEachElem(this.Outputs, (point) => {
            results.push(point.ID);
        });
        // results.sort((a, b) => {
        //     return parseInt(a) - parseInt(b);
        // });
        return results;
    }

    /**
     * Checks to see if this object has the output.
     * @param {string} id The output ID to look for.
     * @returns {boolean} Returns true if the object does have the output.
     */
    hasOutput(id){
        var ret = false;
        try{
            ret = isValid(this.getOutputIDs().find((v) => v == id));
        }
        catch(e){
            console.error(e);
        }
        return ret;
    }

    /**
     * Gets the list of connected inputs, by the output ID they are connected to.
     * @returns {string[]} An array of output IDs.
     */
    getInputIDs(){
        var results = [];
        forEachElem(this.Inputs, (point) => {
            forEachElem(point.Connections, (c) => {
                results.push(c.RefID);
            });
        });
        // results.sort((a, b) => {
        //     return parseInt(a) - parseInt(b);
        // });
        return results;
    }
    /**
     * Checks to see if this object is connected to an output ID on one of its inputs.
     * @param {string} id 
     * @returns {boolean} Returns true if the object is connected to the output.
     */
    hasInput(id){
        var ret = false;
        try{
            ret = isValid(this.getInputIDs().find((v) => v == id));
        }
        catch(e){
            console.error(e);
        }
        return ret;
    }

    /**
     * Converts the object to its representation in Structured Text.
     * @param {string|null} expression The expression to assign to an operator, in the event of a coil, or if a contact.
     * @returns {string} A string representing the structured text code for this object.
     */
    toST(expression){
        var st = "";
        try{
            switch(this.Type){
                case "Contact":
                    if(this.Negated === "true"){
                        st = "NOT ";
                    }
                    st += this.Operand;
                break;
                case "CompareContact":
                    switch(this.Operator){
                        case ">":
                            st = `(${this.Operand1} > ${this.Operand2})`;
                        break;
                        case ">=":
                            st = `(${this.Operand1} >= ${this.Operand2})`;
                        break;
                        case "=":
                            st = `(${this.Operand1} := ${this.Operand2})`;
                        break;
                        case "<=":
                            st = `(${this.Operand1} <= ${this.Operand2})`;
                        break;
                        case "<":
                            st = `(${this.Operand1} < ${this.Operand2})`;
                        break;
                        case "<>":
                            st = `(${this.Operand1} <> ${this.Operand2})`;
                        break;
                    }
                break;
                case "Coil":
                    st = this.Operand + ` := `;
                    if(this.Latch === "none"){
                        if(this.Negated === "true"){
                            st += "NOT ";
                        }
                        st += `(${expression})`;
                    }
                    else if(this.Latch === "set"){
                        st += this.Operand + ` OR (${expression})`;
                    }
                    else if(this.Latch === "reset"){
                        st += `IF (${expression}) THEN
                            ${this.Operand} + " := 0;"
                        END_IF;`;
                    }
                    

                break;
            }
        }
        catch(e){
            console.error(e);
        }
        return st;
    }
}

/**
 * Represents an input connection point in the IEC project file.
 */
export class ConnectionPointIn extends Serializable {
    /**
     * Creates a new ConnectionPointIn object.
     * @param {RelPosition?} RelPosition The relative position of the connection point, or null/undefined
     * @param {Connection[]?} connections An array of connections to the point, or null/undefined.
     */
    constructor(RelPosition, connections) {
        super();
        this.TypeMap = {
            "RelPosition": RelPosition,
            "Connections": []
        };
        this.RelPosition = null;
        this.Connections = [];
        if(isValid(RelPosition)) this.RelPosition = RelPosition;
        if(isValid(connections)) this.Connections = connections;
    }

    /**
     * Creates a new ConnectionPointIn object based on an xml element.
     * @param {Element} xml The XML element from which to create the object.
     * @returns Returns a new ConnectionPointIn object.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        var rel = null;
        var con = null;
        if(xml.getElementsByTagName("RelPosition").length > 0){
            rel = RelPosition.fromXML(xml);
        }
        con = xml.getElementsByTagName("Connection");
        var cons = [];
        forEachElem(con, (e) => {
            cons.push(Connection.fromXML(e));
        });
        return new ConnectionPointIn(rel, cons);
    }

    /**
     * 
     * @returns Returns an xml string representation of the object.
     */
    toXML() {
        var relxml = "";
        var conxml = "";
        if(this.RelPosition != null){
            relxml = this.RelPosition.toXML();
        }
        forEachElem(this.Connections, (c) => {
            conxml += c.toXML() + "\n";
        });
        return `<ConnectionPointIn>
                    ${relxml}
                    ${conxml}
                </ConnectionPointIn>`;
    }
    /**
     * Checks to see if this connection point is connected to an output.
     * @param {string} refID The output ID to check for.
     * @returns {boolean} Returns true if it is connected.
     */
    isConnectedTo(refID){
        return this.Connections.findIndex((c) => c.RefID == refID) > -1;
    }
    /**
     * Connects this point to a given output.
     * @param {string} refID The ID of the output.
     */
    connectTo(refID){
        if(this.Connections.findIndex((c) => c.RefID == refID) == -1){
            this.Connections.push( new Connection(refID));
        }
    }
    /**
     * Disconnects this point from an output.
     * @param {string} refID The output ID to disconnect from.
     */
    disconnect(refID){
        var i = this.Connections.findIndex((c) => c.RefID == refID);
        if(i > -1){
            this.Connections.splice(i, 1);
        }
    }

}

/**
 * Represents an output connection point in the IEC Project file.
 */
export class ConnectionPointOut extends Serializable {
    /**
     * Constructs a new ConnectionPointOut object
     * @param {string?} id The connectionPointId attribute
     * @param {RelPosition?} relPosition The relative position.
     */
    constructor(id, relPosition) {
        super();
        this.TypeMap = {
            "ID": "",
            "RelPosition": RelPosition
        };
        this.ID = "";
        this.RelPosition = null;
        if(isValid(id)) this.ID = id;
        if(isValid(relPosition)) this.RelPosition = relPosition;
    }

    /**
     * Creates a new ConnectionPointOut object based on the xml element.
     * @param {Element} xml An element object represneting the XML.
     * @returns Returns a new ConnectionPointOut object.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        var rel = null;
        if(xml.getElementsByTagName("RelPosition")[0] != null){
            rel = RelPosition.fromXML(xml.getElementsByTagName("RelPosition")[0]);
        }
        return new ConnectionPointOut(xml.getAttribute("connectionPointOutId"), rel);
    }

    /**
     * 
     * @returns Returns an xml string representing the object.
     */
    toXML() {
        var relxml = "";
        if(this.RelPosition != null)
        {
            relxml = this.RelPosition.toXML();
        }
        return `<ConnectionPointOut connectionPointOutId="${this.ID}">
                    ${relxml}
                </ConnectionPointOut>`;
    }
}

/**
 * Represents a size for connections/objects in the IEC project file.
 */
export class Size extends Serializable{
    /**
     * Constructs a new Size object
     * @param {string?} x The width, or null/undefined
     * @param {string?} y The height, or null/undefined
     */
    constructor(x, y) {
        super();
        this.TypeMap = {
            "x": "",
            "y": ""
        };
        this.x = "";
        this.y = "";

        if(isValid(x)) this.x = x;
        if(isValid(y)) this.y = y;
    }

    /**
     * Creates an Size object based on an XML element.
     * @param {Element} xml The element from which to create the object.
     * @returns A new Size object.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        return new Size(xml.getAttribute("x"), xml.getAttribute("y"));
    }

    /**
     * 
     * @returns An XML string representing the object.
     */
    toXML() {
        return `<Size x="${this.x}" y="${this.y}"/>`;
    }
}

/**
 * Represents a relative position for connections/objects in the IEC project file.
 */
export class RelPosition extends Serializable{
    /**
     * Constructs a new RelPosition object
     * @param {string?} x The x coordinate for the position, or null/undefined
     * @param {string?} y The y coordinate for the position, or null/undefined
     */
    constructor(x, y) {
        super();
        this.TypeMap = {
            "x": "",
            "y": ""
        };
        this.x = "0";
        this.y = "0";

        if(isValid(x)) this.x = x;
        if(isValid(y)) this.y = y;
    }

    /**
     * Creates an RelPosition object based on an XML element.
     * @param {Element} xml The element from which to create the object.
     * @returns A new RelPosition object.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        return new RelPosition(xml.getAttribute("x"), xml.getAttribute("y"));
    }

    /**
     * 
     * @returns An XML string representing the object.
     */
    toXML() {
        return `<RelPosition x="${this.x}" y="${this.y}"/>`;
    }
}


/**
 * Represents a connection between an input and output in the IEC Project File.
 */
export class Connection extends Serializable{
    /**
     * Constructs a new Connection object
     * @param {string} refId A reference to the output connection point ID.
     */
    constructor(refId) {
        super();
        this.TypeMap = {
            "RefID": ""
        };
        this.RefID = "";

        if(isValid(refId)) this.RefID = refId;
    }

    /**
     * Creates an Connection object based on an XML element.
     * @param {Element} xml The element from which to create the object.
     * @returns A new Connection object.
     */
    static fromXML(xml) {
        return new Connection(xml.getAttribute("refConnectionPointOutId"));
    }

    /**
     * 
     * @returns An XML string representing the object.
     */
    toXML() {
        return `<Connection refConnectionPointOutId="${this.RefID}"/>`;
    }
}

/**
 * Represents a function block diagram object in the IEC project file.
 */
export class FbdObject extends Serializable {

    /**
     * @type {{TypeName: string, InputVariables: string[], OutputVariables: string[]}[]}
     */
    static StandardBlocks = [
        {
            TypeName: "TON",
            InputVariables: ["IN", "PT"],
            OutputVariables: ["Q", "ET"]
        },
        {
            TypeName: "TOF",
            InputVariables: ["IN", "PT"],
            OutputVariables: ["Q", "ET"]
        },
        {
            TypeName: "TP",
            InputVariables: ["IN", "PT"],
            OutputVariables: ["Q", "ET"]
        },
        {
            TypeName: "OR",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "AND",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "ASSIGNMENT",
            InputVariables: ["IN"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "NOT",
            InputVariables: ["IN"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "XOR",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "NOR",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "NAND",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "SR",
            InputVariables: ["S1", "R"],
            OutputVariables: ["Q1"]
        },
        {
            TypeName: "RS",
            InputVariables: ["S", "R1"],
            OutputVariables: ["Q1"]
        },
        {
            TypeName: "R_TRIG",
            InputVariables: ["CLK"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "F_TRIG",
            InputVariables: ["CLK"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "CTU",
            InputVariables: ["CU", "R", "PV"],
            OutputVariables: ["Q", "CV"]
        },
        {
            TypeName: "CTD",
            InputVariables: ["CD", "LD", "PV"],
            OutputVariables: ["Q", "CV"]
        },
        {
            TypeName: "CTUD",
            InputVariables: ["CU", "CD", "R", "LD", "PV"],
            OutputVariables: ["QU", "QD", "CV"]
        },
        {
            TypeName: "EQ",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "NE",
            InputVariables: ["IN1, IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "LT",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "GT",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "GE",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "LE",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "MOVE",
            InputVariables: ["IN"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "SEL",
            InputVariables: ["G", "IN0", "IN1"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "MUX",
            InputVariables: ["K", "IN0", "IN1"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "MIN",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "MAX",
            InputVariables: ["IN1", "IN2"],
            OutputVariables: ["OUT"]
        },
        {
            TypeName: "LIMIT",
            InputVariables: ["MN", "IN", "MX"],
            OutputVariables: ["OUT"]
        },
    ];

    /**
     * Creates an instantiation of an FbdObject block based on the given properties.
     * @param {string} typeName The type of the FBD
     * @param {string} instanceName The instance name for the block.
     * @param {string[]} inputvars An array of input variable names. The input variables can be negated with the prefix "!"
     * @param {string[]} outvars An array of output variable names.
     * @param {Rung|Network} root The root rung or network to which this block is to be added.
     */
    static createStandardBlock(typeName, instanceName, inputvars, outvars, root){
        
        const height = FbdObject.BLOCK_HEIGHT + ((Math.max(inputvars.length, outvars.length) - 1) * FbdObject.SIZE_INC);
        const inputVariables = new InputVariables();
        const outputVariables = new OutputVariables();
        forEachElem(inputvars, (v) => {
            let vname = v;
            let negated = "false";
            if(v.startsWith("!")){
                vname = v.substring(1);
                negated = "true";
            }
            inputVariables.Variables.push(new InputVariable(vname, negated, new ConnectionPointIn()));
        });
        var startOut = root.findLastOutputID() + 1;
        forEachElem(outvars, (v) => {
            outputVariables.Variables.push(new OutputVariable(v, new ConnectionPointOut(startOut)));
            startOut++;
        });
        return new FbdObject("Block", instanceName, typeName, instanceName, 
            new Size(FbdObject.BLOCK_WIDTH, height),
            new RelPosition(root.findGreatestX() + FbdObject.BLOCK_WIDTH, root.findGreatestY()),
            inputVariables,
            outputVariables,
            null, null, root
        );
    }

    /**
     * Creates a new FbdObject based on the definition provided by a function block.
     * @param {FunctionBlock} functionBlock The function block from which to create the object.
     * @param {Rung|Network} root The root/parent of the object.
     */
    static createCustomBlock(functionBlock, root){
        const inputVariables = new InputVariables();
        const outputVariables = new OutputVariables();
        forEachElem(functionBlock.Parameters.InputVars.Variables, (v) => {
            inputVariables.Variables.push(new InputVariable(v.Name, "false", new ConnectionPointIn()));
        });
        var startOut = root.findLastOutputID() + 1;
        
        forEachElem(functionBlock.Parameters.OutputVars.Variables, (v) => {
            outputVariables.Variables.push(new OutputVariable(v.Name, new ConnectionPointOut(startOut)));
            startOut++;
        });
        const height = FbdObject.BLOCK_HEIGHT + ((Math.max(inputVariables.Variables.length, outputVariables.Variables.length) - 1) * FbdObject.SIZE_INC);
        
        return new FbdObject("Block", instanceName, typeName, instanceName, 
            new Size(FbdObject.BLOCK_WIDTH, height),
            new RelPosition(root.findGreatestX() + FbdObject.BLOCK_WIDTH, root.findGreatestY()),
            inputVariables,
            outputVariables,
            null, null, root
        );
    }

    /**
     * Creates a new FBD object of the datasource type.
     * @param {string} identifier The identifier of the data source.
     * @param {LdObject|FbdObject} root The root rung or network to which this datasource belongs.
     * @returns 
     */
    static createDataSource(identifier, root){
        const BASE_WIDTH = 48, BASE_HEIGHT = 24;
        return new FbdObject("DataSource", identifier, "", "", 
            new Size(BASE_WIDTH, BASE_HEIGHT),
            new RelPosition(root.findGreatestX() + (BASE_WIDTH*2), root.findGreatestY()),
            null, null, null,
            [
                new ConnectionPointOut(root.findLastOutputID() + 1)
            ], root);
    }

    /**
     * Creates a new FBD object of the datasink type.
     * @param {string} identifier The identifier of the data sink.
     * @param {LdObject|FbdObject} root The root rung or network to which this sink belongs.
     * @returns 
     */
    static createDataSink(identifier, root){
        const BASE_WIDTH = 48, BASE_HEIGHT = 24;
        return new FbdObject("DataSink", identifier, "", "", 
            new Size(BASE_WIDTH, BASE_HEIGHT),
            new RelPosition(root.findGreatestX() + (BASE_WIDTH*2), root.findGreatestY()),
            null, null,
            [
                new ConnectionPointIn()
            ],
            null, root);
    }

    
    /**
     * Constructs a new FbdObject
     * @param {string?} type The type of object, or null/undefined.
     * @param {string?} identifier The identifier for the object, or null/undefined
     * @param {Size?} size the size of the object, or null/undefined
     * @param {RelPosition?} relPosition the relative position of the object, or null/undefined
     * @param {InputVariables?} invars the input variables of the object, or null/undefined
     * @param {OutputVariables?} outvars the output variables of the object, or null/undefined
     * @param {ConnectionPointIn[]?} inputs An array of ConnectionPointIn objects, or null/undefined
     * @param {ConnectionPointOut[]?} outputs An array of ConnectionPointOut objects, or null/undefined
     * @param {Rung|Network|null} parent The parent object that contains this object or null/undefined.
     */
    constructor(type, identifier, typeName, instanceName, size, relPosition, invars, outvars, inputs, outputs, parent) {
        super();
        this.TypeMap = {
            "Type": "",
            "Identifier": "",
            "TypeName": "",
            "InstanceName": "",
            "Inputs": [],
            "Outputs": [],
            "InputVariables": InputVariables,
            "OutputVariables": OutputVariables,
            "Size": Size,
            "RelPosition": RelPosition
        };
        this.ID = generateGUID();
        this.Type = "";
        this.Identifier = "";
        this.TypeName = "";
        this.InstanceName = "";
        this.Inputs = [];
        this.Outputs = [];
        this.InputVariables = new InputVariables();
        this.OutputVariables = new OutputVariables();
        this.Size = null;
        this.RelPosition = new RelPosition(0, 0);
        this.Parent = null;
        
        if(isValid(type)) this.Type = type;
        if(isValid(identifier)) this.Identifier = identifier;
        if(isValid(size)) this.Size = size;
        if(isValid(relPosition)) this.RelPosition = relPosition;
        if(isValid(invars)) this.InputVariables = invars;
        if(isValid(outvars)) this.OutputVariables = outvars;
        if(isValid(inputs) && type !== "Block") this.Inputs = inputs;
        if(isValid(outputs) && type !== "Block") this.Outputs = outputs;
        if(isValid(typeName)) this.TypeName = typeName;
        if(isValid(instanceName)) this.InstanceName = instanceName;
        if(isValid(parent)) this.Parent = parent;
    }

    /**
     * Creates a new FbdObject from the element.
     * @param {Element} xml The xml element to create the object from.
     * @param {Rung|Network} parent The containing object for this object.
     * @returns Returns null if the xml is invalid, or returns a new FbdObject.
     */
    static fromXML(xml, parent) {
        if(!isValid(xml)) return null;
        var inxml = xml.getElementsByTagName("ConnectionPointIn");
        var outxml = xml.getElementsByTagName("ConnectionPointOut");
        var conins = [];
        var conouts = [];
        forEachElem(inxml, (c) => {
            conins.push(ConnectionPointIn.fromXML(c));
        });
        forEachElem(outxml, (c) => {
            conouts.push(ConnectionPointOut.fromXML(c));
        });
        return new FbdObject(
            xml.getAttribute("xsi:type"),
            xml.getAttribute("identifier"),
            xml.getAttribute("typeName"),
            xml.getAttribute("instanceName"),
            Size.fromXML(xml.getElementsByTagName("Size").item(0)),
            RelPosition.fromXML(xml.getElementsByTagName("RelPosition").item(0)),
            InputVariables.fromXML(xml.getElementsByTagName("InputVariables").item(0)),
            OutputVariables.fromXML(xml.getElementsByTagName("OutputVariables").item(0)),
            conins, conouts,
            parent
        );
    }

    /**
     * 
     * @returns Returns an xml string representing the object.
     */
    toXML() {
        
        var inputs = "";
        var outputs = "";
        forEachElem(this.Inputs, (elem) => {
            inputs += elem.toXML() + "\n";
        });
        forEachElem(this.Outputs, (elem) => {
            outputs += elem.toXML() + "\n";
        });
        
        return `<FbdObject xsi:type="${this.Type}" identifier="${this.Identifier}" typeName="${this.TypeName}" instanceName="${this.InstanceName}">
                    ${this.RelPosition.toXML()}
                    ${this.InputVariables?.toXML()}
                    ${this.OutputVariables?.toXML()}
                    ${inputs}
                    ${outputs}
                </FbdObject>`;
    }

    /**
     * Checks to see if an output is connected to this object.
     * @param {string} refOutID The output ID to check for.
     * @returns {string} If the output ID is connected on an input variable, the function returns the input variable name.
     * If it is connected on an input point, it returns the ID. If it is not connected, it returns an empty string.
     */
    isConnectedTo(refOutID){
        var retval = "";
        try{
            if(this.Type === "Block")
                retval = this.InputVariables.isConnectedTo(refOutID);
            else{
                forEachElem(this.Inputs, 
                    /**
                     * 
                     * @param {ConnectionPointIn} i 
                     */
                    (i) => {
                        forEachElem(i.Connections, (c) => {
                            if(c.RefID === refOutID){
                                retval = c.RefID;
                            }
                        });
                });
            }
        }
        catch(e){
            console.error(e);
        }
        return retval;
    }

    /**
     * Connects this object to an output ID.
     * @param {string} outID The output ID to connect to.
     * @param {string} invar The input variable on which to connect. If blank, the function connects the output to an input.
     */
    connectTo(outID, invar=""){
        try{
            if(invar.length > 0){

                this.InputVariables.connectTo(outID, invar);
            }
            else{
                var connected = false;
                forEachElem(this.Inputs, (point) => {
                    if(connected) return;
                    if(point.isConnectedTo(outID)){
                        connected = true;
                    }
                    else{
                        point.connectTo(outID);
                        connected = true;
                    }
                });
            }
        }
        catch(e){
            console.error(e);
        }
    }

    /**
     * Disconnects the output from the object.
     * @param {string} outID The output to disconnect.
     */
    disconnect(outID){
        var found = false;
        forEachElem(this.Inputs, (point) => {
            if(found) return;
            if(point.isConnectedTo(outID)){
                point.disconnect(outID);
                found = true;
            }
        });
        if(!found){
            this.InputVariables.disconnect(outID);
        }
    }


    /**
     * Creates an array of output IDs for this object.
     * @returns {string[]} An array of output IDs for this object.
     */
    getOutputIDs(){
        var results = [];
        forEachElem(this.Outputs, (point) => {
            results.push(point.ID);
        });
        forEachElem(this.OutputVariables.Variables, (v) => {
            results.push(v.OutputPoint.ID);
        });
        // results.sort((a, b) => {
        //     return parseInt(a) - parseInt(b);
        // });
        return results;
    }

    /**
     * Checks to see if this object has the given output ID.
     * @param {string} id 
     * @returns {boolean} Returns true if the object has the output.
     */
    hasOutput(id){
        var ret = false;
        try{
            ret = isValid(this.getOutputIDs().find((v) => v == id));
        }
        catch(e){
            console.error(e);
        }
        return ret;
    }

    /**
     * Gets an array of output IDs to which this object's inputs are connected.
     * @returns {string[]} An array of IDs.
     */
    getInputIDs(){
        var results = [];
        forEachElem(this.Inputs, (point) => {
            forEachElem(point.Connections, (c) => {
                results.push(c.RefID);
            });
        });
        forEachElem(this.InputVariables.Variables, (v) => {
            forEachElem(v.InputPoint.Connections, (c) => {

                results.push(c.RefID);
            });
        });
        // results.sort((a, b) => {
        //     return parseInt(a) - parseInt(b);
        // });
        return results;
    }

    /**
     * Checks to see if this object is connected to an output ID.
     * @param {string} id The output ID to look for.
     * @returns {boolean} Returns true if the object has an input for the given output ID.
     */
    hasInput(id){
        var ret = false;
        try{
            ret = isValid(this.getInputIDs().find((v) => v == id));
        }
        catch(e){
            console.error(e);
        }
        return ret;
    }

    /**
     * Converts the object to structured text code, based on the variable provided.
     * If the variable is an input variable, or it is empty and this is a datasink, then the function creates an assignment based on the provided expression.
     * If the variable is an output, or it is empty and this is a datasource, it creates the expression for assignment.
     * @param {string} variable The variable name to create ST for. If empty and this is a datasource or datasink, then
     * @param {string} expression The expression to assign to an input variable or datasink.
     * @returns {string} Returns a string representing the structured text code for the object.
     */
    toST(variable = "", expression=""){
        var st = "";
        try{
            switch(this.Type){
                case "DataSource":
                    st = this.Identifier;
                break;
                case "DataSink":
                    st = `${this.Identifier} := (${expression})`;
                break;
                case "Block":
                    var v = this.InputVariables.Variables.find((val) => val.ParameterName === variable);
                    if(isValid(v)){
                        if(v.Negated === "true"){
                            st = "NOT ";
                        }
                        st += `${this.InstanceName}.${variable} := ${expression}`;
                    }
                    else{
                        v = this.OutputVariables.Variables.find((val) => val.ParameterName === variable);
                        if(isValid(v)){
                            st = `${this.InstanceName}.${variable}`;
                        }
                    }
                break;
            }
        }
        catch(e){
            console.error(e);
        }
        return st;
    }
}

/**
 * Represents a CommonObject element in an IEC project file.
 */
export class CommonObject extends Serializable{
    /**
     * Constructs a new CommonObject object.
     * @param {string} type The type of the object, or null/undefined
     * @param {RelPosition} relPosition the relative position of the object, or null/undefined
     * @param {Content} content The content of the object, or null/undefined
     */
    constructor(type, relPosition, content) {
        super();
        this.TypeMap = {
            "Type": "",
            "RelPosition": RelPosition,
            "Content": Content
        };
        this.Type = "Comment";
        this.RelPosition = null;
        this.Content = null;
        if(isValid(type)) this.Type = type;
        if(isValid(this.RelPosition)) this.RelPosition = relPosition;
        if(isValid(this.Content)) this.Content = content;
    }

    /**
     * Creates a new CommonObject object based on the given xml Element.
     * @param {Element} xml The xml element from which to create the object.
     * @returns Returns a new CommonObject object, or null if the XML is not valid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        return new CommonObject(
            xml.getAttribute("xsi:type"),
            RelPosition.fromXML(xml.getElementsByTagName("RelPosition")[0]),
            Content.fromXML(xml.getElementsByTagName("Content")[0])
        );
    }

    /**
     * 
     * @returns Returns a string of xml representing the object.
     */
    toXML() {
        return `<CommonObject xsi:type="${this.Type}">
                    ${this.RelPosition ? this.RelPosition.toXML() : ""}
                    ${this.Content ? this.Content.toXML() : ""}
                </CommonObject>`;
    }
}

/**
 * Represents a Content element of the IEC project file.
 */
export class Content extends Serializable{
    /**
     * Constructs a new Content object.
     * @param {string} type The type for the content, or null/undefined
     * @param {string} content The content of the object, or null/undefined
     */
    constructor(type, content){
        super();
        this.TypeMap = {
            "Type": "",
            "Content": ""
        };
        this.Type = "SimpleText";
        this.Content = "";
        if(isValid(type)) this.Type = type;
        if(isValid(content)) this.Content = content;
    }
    /**
     * Creates a new Content object based on the xml element.
     * @param {Element} xml The element from which to create the object.
     * @returns returns a new Content object, or null if the xml is not valid.
     */
    static fromXML(xml){
        if(!isValid(xml)) return null;
        return new Content(xml.getAttribute("xsi:type"), xml.textContent);
    }

    /**
     * 
     * @returns Returns an xml string representing the content object.
     */
    toXML(){
        return `<Content xsi:type="${this.Type}>
            ${this.Content}
        </Content>`;
    }
}

/**
 * Represents a Parameters element in the IEC project file.
 */
export class Parameters extends Serializable {
    /**
     * Constructs a new Parameters object.
     * @param {OutputVars} outputVars An OutputVars object, or null/undefined.
     * @param {InputVars} inputVars an InputVars object, or null/undefined;
     */
    constructor(outputVars, inputVars) {
        super();
        this.TypeMap = {
            "InputVars": InputVars,
            "OutputVars": OutputVars
        };
        this.InputVars = new InputVars();
        this.OutputVars = new OutputVars();

        if(isValid(outputVars)) this.OutputVars = outputVars;
        if(isValid(inputVars)) this.InputVars = inputVars;
    }

    /**
     * Creates a new Parameters object based on an xml element.
     * @param {Element} xml The XML element to create the object from.
     * @returns Returns a new Parameters object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        return new Parameters(
            OutputVars.fromXML(xml.getElementsByTagName("OutputVars")[0]),
            InputVars.fromXML(xml.getElementsByTagName("InputVars")[0])
        );
    }

    /**
     * 
     * @returns Returns a string of xml representing the object.
     */
    toXML() {
        return `<Parameters>
                    ${this.OutputVars.toXML()}
                    ${this.InputVars.toXML()}
                </Parameters>`;
    }
}

/**
 * Represents an InputVariables element in the IEC project file.
 */
export class InputVariables extends Serializable {
    /**
     * Constructs a new InputVariables object.
     * @param {InputVariable[]?} variables An array of InputVariable objects, or null/undefined;
     */
    constructor(variables) {
        super();
        this.TypeMap = {
            "Variables": []
        };
        this.Variables = [];
        if(isValid(variables)) this.Variables = variables;
    }
    /**
     * Creates a new InputVariables object from an xml element.
     * @param {Element} xml The XML element from which to create the object.
     * @returns Returns a new InputVariables object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        var vars = xml.getElementsByTagName("InputVariable");
        var invars = [];
        forEachElem(vars, (v) => {
            invars.push(InputVariable.fromXML(v));
        });
        return new InputVariables(invars);
    }

    /**
     * 
     * @returns Returns a string of xml that represents the object.
     */
    toXML() {
        return `<InputVariables>
                    ${this.Variables.map(v => v.toXML()).join("\n")}
                </InputVariables>`;
    }

    /**
     * Checks to see if one of the input variables is connected to the given output ID.
     * @param {string} refID The output ID to check.
     * @returns {string} Returns the name of the variable if connected, or an empty string if not.
     */
    isConnectedTo(refID){
        var retval = "";
        try{
            forEachElem(this.Variables, (v) => {
                if(retval.length > 0){
                    return;
                }
                retval = v.isConnectedTo(refID);
                
            });
        }
        catch(e){
            console.error(e);
        }
        return retval;
    }

    /**
     * Connects an output to a given input variable.
     * @param {string} refID The output ID to connect to.
     * @param {string} invar The input variable to connect the output to.
     */
    connectTo(refID, invar){
        try{
            if(invar.length == 0) return;
            var found = false;
            forEachElem(this.Variables, (v) => {
                if(found) return;
                if(v.ParameterName == invar){
                    v.connectTo(refID);
                    found = true;
                }
            });
        }
        catch(e){
            console.error(e);
        }
    }

    /**
     * Disconnects the output from one of the input variables.
     * @param {string} refID The output ID to disconnect.
     */
    disconnect(refID){
        forEachElem(this.Variables, (v) => {
            if(v.isConnectedTo(refID)){
                v.disconnect(refID);
            }
        });
    }
}

/**
 * Represents an OutputVariables element in an IEC project file.
 */
export class OutputVariables extends Serializable {
    /**
     * Constructs a new OutputVariables object.
     * @param {OutputVariable[]} variables An array of OutputVariable objects, or null/undefined
     */
    constructor(variables) {
        super();
        this.TypeMap = {
            "Variables": []
        };
        this.Variables = [];
        if(isValid(variables)) this.Variables = variables;
    }
    /**
     * Creates a new OutputVariables object from an xml element.
     * @param {Element} xml The xml element from which to create an object.
     * @returns Returns a new OutputVariables object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        var vars = xml.getElementsByTagName("OutputVariable");
        var outvars = [];
        forEachElem(vars, (v) => {
            outvars.push(OutputVariable.fromXML(v));
        });
        return new OutputVariables(outvars);
    }

    /**
     * 
     * @returns Returns an xml string representing the object.
     */
    toXML() {
        return `<OutputVariables>
                    ${this.Variables.map(v => v.toXML()).join("\n")}
                </OutputVariables>`;
    }
}

/**
 * Represents a Vars element in the IEC project file.
 */
export class Vars extends Serializable{
    /**
     * Constructs a new Vars object.
     * @param {Array} variables An array of Variable objects, or null/undefined
     */
    constructor(access, variables) {
        super();
        this.TypeMap = {
            "Access": "",
            "Variables": []
        };
        this.Access = "private";
        this.Variables = [];
        if(isValid(access)) this.Access = access;
        if(isValid(variables)) this.Variables = variables;
    }

    /**
     * Creates a Vars object from an xml element.
     * @param {Element} xml The xml element from which to create the object.
     * @returns A new Vars object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        var list = xml.getElementsByTagName("Variable");
        var vl = [];
        forEachElem(list, (elem) => {
            vl.push(Variable.fromXML(elem));
        });
        return new Vars(
            xml.getAttribute("accessSpecifier"),
            vl
        );
    }

    /**
     * 
     * @returns Returns a string of xml representing the object.
     */
    toXML() {
        return `<Vars accessSpecifier="${this.Access}">
                    ${this.Variables.map(v => v.toXML()).join("\n")}
                </Vars>`;
    }
}

/**
 * Represents an ExternalVars element in the IEC project file.
 */
export class ExternalVars extends Serializable {
    /**
     * Constructs a new ExternalVars object.
     * @param {Variable[]?} variables An array of Variable objects, or null/undefined
     */
    constructor(variables) {
        super();
        this.TypeMap = {
            "Variables":[]
        };
        this.Variables = [];
        if(isValid(variables)) this.Variables = variables;
    }

    /**
     * Creates a new ExternalVars object based on the xml element.
     * @param {Element} xml The XML element from which to create the object.
     * @returns Returns a new EternalVars object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        var list = xml.getElementsByTagName("Variable");
        var vl = [];
        if(isValid(list)){
            forEachElem(list, (elem) => {
                vl.push(Variable.fromXML(elem));
            });
        }
        return new ExternalVars(
            vl
        );
    }

    /**
     * 
     * @returns Returns an xml string representing the object.
     */
    toXML() {
        return `<ExternalVars>
                    ${this.Variables.map(v => v.toXML()).join("\n")}
                </ExternalVars>`;
    }
}

/**
 * Represents a Variable element in the IEC project file.
 */
export class Variable extends Serializable{
    /**
     * Constructs a new Variable object.
     * @param {string?} name The name of the Variable, or null/undefined
     * @param {Type?} type The type of the variable, or null/undefined
     * @param {string?} order The order of the variable in the parameter list, or null/undefined
     * @param {Address?} address The address for the variable.
     */
    constructor(name, type, order, address) {
        super();
        this.TypeMap = {
            "Name": "",
            "Type": Type,
            "Order": "Order",
            "Address": Address
        };
        this.Name = "Var1";
        this.Type = new Type("ULINT");
        this.Order = "";
        this.Address = null;
        if(isValid(name)) this.Name = name;
        if(isValid(type)) this.Type = type;
        if(isValid(order)) this.Order = order;
        if(isValid(address)) this.Address = address;
    }

    /**
     * Creates a new Variable object based on an xml element.
     * @param {Element} xml The xml element from which to create the object.
     * @returns Returns a new Variable object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        return new Variable(
            xml.getAttribute("name"),
            Type.fromXML(xml.getElementsByTagName("Type")[0]),
            xml.getAttribute("orderWithinParamSet"),
            Address.fromXML(xml.getElementsByTagName("Address")[0])
        );
    }

    /**
     * 
     * @returns Returns an xml string representing the variable.
     */
    toXML() {
        return `<Variable name="${this.Name}" orderWithinParamSet="${this.Order}">
                    ${this.Type?.toXML()}
                    ${this.Address?.toXML()}
                </Variable>`;
    }
}

/**
 * Represents an input variable on a FbdObject in the IEC file.
 */
export class InputVariable extends Serializable{
    /**
     * Constructs a new InputVariable object.
     * @param {string?} parameterName The name of the parameter, or null/undefined
     * @param {string?} negated true/false, indicates whether the input should be negated.
     * @param {ConnectionPointIn?} inPoint The connection point for the variable, or null/undefined
     */
    constructor(parameterName, negated, inPoint) {
        super();
        this.TypeMap = {
            "ParameterName": "",
            "Negated": "",
            "InputPoint": ConnectionPointIn
        };
        this.ParameterName = "";
        this.Negated = "false";
        this.InputPoint = new ConnectionPointIn();
        if(isValid(parameterName)) this.ParameterName = parameterName;
        if(isValid(inPoint)) this.InputPoint = inPoint;
        if(isValid(negated)) this.Negated = negated;
    }

    /**
     * Creates a new InputVariable based on the xml element.
     * @param {Element} xml The XML element from which to create the object.
     * @returns Returns a new InputVariable object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        return new InputVariable(
            xml.getAttribute("parameterName"),
            xml.getAttribute("negated"),
            ConnectionPointIn.fromXML(xml.getElementsByTagName("ConnectionPointIn")[0])
        );
    }

    /**
     * 
     * @returns Returns a string of xml representing the object.
     */
    toXML() {
        return `<InputVariable parameterName="${this.ParameterName}" negated="${this.Negated}">
                    ${this.InputPoint?.toXML()}
                </InputVariable>`;
    }

    /**
     * Checks to see if the variable is connected to an output.
     * @param {string} refID The output ID to look for.
     * @returns {string} Returns the name of the variable if it is connected, or an empty string if not.
     */
    isConnectedTo(refID){
        var retval = "";
        try{
            if(this.InputPoint.isConnectedTo(refID)){
                retval = this.ParameterName;
            }
        }
        catch(e){
            console.error(e);
        }
        return retval;
    }

    /**
     * Connects this variable to an output.
     * @param {string} refID The output ID to which we should connect.
     */
    connectTo(refID){
        this.InputPoint.connectTo(refID);
    }
    /**
     * Disconnects an output ID from the input point of this variable.
     * @param {string} refID The output ID to disconnect
     */
    disconnect(refID){
        this.InputPoint.disconnect(refID);
    }
}

/**
 * Represents an OutputVariable element in the IEC project file.
 */
export class OutputVariable extends Serializable{
    /**
     * Constructs a new OutputVariable object.
     * @param {string} parameterName The name of the parameter, or null/undefined
     * @param {ConnectionPointIn} outPoint The connection point for the variable, or null/undefined
     */
    constructor(parameterName, outPoint) {
        super();
        this.TypeMap = {
            "ParameterName": "",
            "OutputPoint": ConnectionPointOut
        };
        this.ParameterName = "";
        this.OutputPoint = new ConnectionPointOut();

        if(isValid(parameterName)) this.ParameterName = parameterName;
        if(isValid(outPoint)) this.OutputPoint = outPoint;
    }

    /**
     * Creates a new OutputVariable based on the xml element.
     * @param {Element} xml The XML element from which to create the object.
     * @returns Returns a new OutputVariable object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        return new OutputVariable(
            xml.getAttribute("parameterName"),
            ConnectionPointOut.fromXML(xml.getElementsByTagName("ConnectionPointOut")[0])
        );
    }

    /**
     * 
     * @returns Returns a string of xml representing the object.
     */
    toXML() {
        return `<OutputVariable parameterName="${this.ParameterName}">
                    ${this.OutputPoint?.toXML()}
                </OutputVariable>`;
    }
}

/**
 * Represents an OutputVars element in the IEC project file.
 */
export class OutputVars extends Serializable{
    /**
     * Constructs a new OutputVars object.
     * @param {Array} variables An array of Variable objects, or null/undefined
     */
    constructor(variables) {
        super();
        this.TypeMap = {
            "Variables": []
        };
        this.Variables = [];
        if(isValid(variables)) this.Variables = variables;
    }

    /**
     * Creates a new OutputVars object based on an xml element.
     * @param {Element} xml The xml element from which to create an object.
     * @returns Returns a new OutputVars object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        var vars = [];
        forEachElem(xml.getElementsByTagName("Variable"), (v) => {
            vars.push(Variable.fromXML(v));
        });
        return new OutputVars(
            vars
        );
    }

    /**
     * 
     * @returns Returns a string of xml that represents the object.
     */
    toXML() {
        return `<OutputVars>
                    ${this.Variables.map(v => v.toXML()).join("\n")}
                </OutputVars>`;
    }
}

/**
 * Represents an InputVars element in an IEC project file.
 */
export class InputVars extends Serializable{
    /**
     * Constructs a new InputVars object.
     * @param {Array} variables An array of Variable objects, or null/undefined
     */
    constructor(variables) {
        super();
        this.TypeMap = {
            "Variables": []
        };
        this.Variables = [];
        if(isValid(variables)) this.Variables = variables;
    }

    /**
     * Creates a new InputVars object based on an xml element.
     * @param {Element} xml The xml element from which to create an object.
     * @returns Returns a new InputVars object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        var vars = [];
        forEachElem(xml.getElementsByTagName("Variable"), (v) => {
            vars.push(Variable.fromXML(v));
        });
        return new InputVars(
            vars
        );
    }
    /**
     * 
     * @returns Returns a string of xml representing the object.
     */
    toXML() {
        return `<InputVars>
                    ${this.Variables.map(v => v.toXML()).join("\n")}
                </InputVars>`;
    }
}

/**
 * Represents a Type element in the IEC Project file.
 */
export class Type extends Serializable{
    /**
     * Constructs a new Type object.
     * @param {string} typeName The name of the type, or null/undefined
     */
    constructor(typeName) {
        super();
        this.TypeMap = {
            "TypeName": ""
        };
        this.TypeName = "ULINT";

        if(isValid(typeName)) this.TypeName = typeName;
    }

    /**
     * Creates a new Type object based on an xml element.
     * @param {Element} xml The element to create the object from.
     * @returns Returns a new Type object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        return new Type(
            xml.getElementsByTagName("TypeName")[0]?.textContent || ""
        );
    }

    /**
     * 
     * @returns Returns an xml string representing the object.
     */
    toXML() {
        return `<Type>
                    <TypeName>${this.TypeName}</TypeName>
                </Type>`;
    }


}

/**
 * Represents an Address element in the IEC Project file.
 */
export class Address extends Serializable{
    /**
     * Constructs a new Address object.
     * @param {string} typeName The name of the type, or null/undefined
     */
    constructor(location, size, address) {
        super();
        this.TypeMap = {
            "Location": "",
            "Size": "",
            "Address": ""
        };
        this.Location = "Q";
        this.Size = "X";
        this.Address = "";

        if(isValid(location)) this.Location = location;
        if(isValid(size)) this.Size = size;
        if(isValid(address)) this.Address = address;
    }

    /**
     * Creates a new Address object based on an xml element.
     * @param {Element} xml The element to create the object from.
     * @returns Returns a new Address object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        return new Address(xml.getAttribute("location"), xml.getAttribute("size"), xml.getAttribute("address"));
    }

    /**
     * 
     * @returns Returns an xml string representing the object.
     */
    toXML() {
        return `<Address location="${this.Location}" size="${this.Size}" address="${this.Address}"></Address>`;
    }
}

/**
 * Represents a Mapping Table for I/O to a PLC (not IEC standard).
 */
export class MappingTable extends Serializable{
    /**
     * Constructs a new MappingTable object.
     * @param {Map[]?} maps An array of Map objects.
     */
    constructor(maps) {
        super();
        this.TypeMap = {
            "Maps": []
        };
        this.Maps = [];
        if(isValid(maps)) this.Maps = maps;
    }

    /**
     * Creates a new MappingTable object based on an xml element.
     * @param {Element} xml The xml element from which to create the object.
     * @returns Returns a new MappingTable object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        var maps = [];
        forEachElem(xml.getElementsByTagName("Map"), (v) => {
            maps.push(Map.fromXML(v));
        });
        
        return new MappingTable(maps);
    }

    /**
     * 
     * @returns Returns an xml string representing the variable.
     */
    toXML() {
        var maps = "";
        forEachElem(this.Maps, (m) => {
            maps += m.toXML() + "\n";
        });
        return `<MappingTable>
                    ${maps}
                </MappingTable>`;
    }

    /**
     * Creates structured text references for the mapping table.
     * @param {string?} resource If the resource name is provided, it filters the table by this resource.
     */
    toST(resource){
        var res = "";
        var maps = "";
        if(isValid(resource)) res = resource;
        forEachElem(this.Maps, m => {
            if(res === "" || m.Resource === res){
                maps += m.toST() + "\n";
            }
        });
        return maps;
    }
}

export const ModuleProtocols = Object.freeze([
    "MODBUS-TCP",
    "MODBUS-RTU",
    "OPCUA",
    "BACNET-IP",
    "MTI"
]);

/**
 * Represents a Map of remote I/O to internal memory on the PLC (not IEC standard.)
 */
export class Map extends Serializable{

    /**
     * Constructs a new Map object.
     * @param {string?} moduleID The ID of the remote module. This can be the IP address or a unique ID used by the specific protocol.
     * @param {string?} modulePort the port to the remtoe module.
     * @param {string?} protocol Identifies the protocol for the remote module. Protocols are defined by the "ModuleProtocols" constant.
     * @param {string?} remoteAddress The address within the module to map.
     * @param {string?} remoteSize The size of the address, in bits.
     * @param {string?} internalAddress The address reference to internal PLC memory. This should be the standard address reference format, without the %.
     * @param {string?} resource The resource name assocated with this map.
     * @param {string?} pollTime The time in milliseconds that this module should be polled.
     * @param {string?} protocolProperties This is a JSON string defining additional properties that should be defined for the protocol. For example, in BACNET/IP you must identify the object, property, and value type.
     */
    constructor(moduleID, modulePort, protocol, remoteAddress, remoteSize, internalAddress, resource, pollTime, protocolProperties) {
        super();
        this.TypeMap = {
            "ModuleID": "",
            "ModulePort": "",
            "Protocol": "",
            "RemoteAddress": "",
            "RemoteSize": "",
            "InternalAddress": "",
            "Resource": "",
            "PollTime": "",
            "ProtocolProperties": ""
        };
        this.ModuleID = "";
        this.ModulePort = "";
        this.Protocol = "";
        this.RemoteAddress = "";
        this.RemoteSize = "";
        this.InternalAddress = "";
        this.PollTime = "";
        this.ProtocolProperties = "";
        this.Resource = "";

        if(isValid(moduleID)) this.ModuleID = moduleID;
        if(isValid(modulePort)) this.ModulePort = modulePort;
        if(isValid(protocol)) this.Protocol = protocol;
        if(isValid(remoteAddress)) this.RemoteAddress = remoteAddress;
        if(isValid(remoteSize)) this.RemoteSize = remoteSize;
        if(isValid(internalAddress)) this.InternalAddress = internalAddress;
        if(isValid(pollTime)) this.PollTime = pollTime;
        if(isValid(protocolProperties)) this.ProtocolProperties = protocolProperties;
        if(isValid(resource)) this.Resource = resource;
    }

    /**
     * Creates a new Map object based on an xml element.
     * @param {Element} xml The element to create the object from.
     * @returns {Map} Returns a new Map object, or null if the xml is invalid.
     */
    static fromXML(xml) {
        if(!isValid(xml)) return null;
        return new Map(xml.getAttribute("ModuleID"), xml.getAttribute("ModulePort"), xml.getAttribute("Protocol"), xml.getAttribute("RemoteAddress"), xml.getAttribute("RemoteSize"), xml.getAttribute("InternalAddress"), xml.getAttribute("Resource"), xml.getAttribute("PollTime"), xml.getAttribute("ProtocolProperties"));
    }


    /**
     * 
     * @returns Returns an xml string representing the object.
     */
    toXML() {
        return `<Map ModuleID="${this.ModuleID}" ModulePort="${this.ModulePort}" Protocol="${this.Protocol}" RemoteAddress="${this.RemoteAddress}" RemoteSize="${this.RemoteSize}" InternalAddress="${this.InternalAddress}" Resource="${this.Resource}" PollTime="${this.PollTime}" ProtocolProperties="${escapeXmlAttr(this.ProtocolProperties)}"></Map>`;
    }

    toST(){
        return "//Map=" + this.toJSON().replaceAll("\\", "\\\\").replaceAll(`"`, `\\"`);
    }
}