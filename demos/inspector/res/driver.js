
import {uuid} from "@sciter";

export class ChannelDriver
{
  request = null; // function to request data from debugee 
  notify = null; // function to notify debugee 

  theirLogs = [];
  theirFiles = {};
  breakpoints = [];
  callstack = [];
  key = null;
  atBreakpoint = false; // true if at breakpoint
  breakpointHitNo = 0;

  variables = null; // frame variables
  variablesId = 0;
  variablesFrameId = 0;

  viewstate = {}; // storage of view states
  view = null;    // ChannelView

  constructor(outboundRq) 
  {
    this.request = function(name,params) { return new Promise((resolve,reject) => { outboundRq(name,params,resolve); }); }
    this.notify = outboundRq;
  }

  get connected() { return this.request !== null; }
  // debugee is gone, channel closed
  gone() {
    this.request = null;
    document.dispatchEvent(new Event("channel-gone"),true);
  }

  // handle inbound message from debugee
  handle(name,data) {
    var fcn = ChannelDriver[name];
    if(fcn) return fcn.call(this,data);
    else console.log("unknown message", name);
  }

  addBreakpoint(filename,lineno,enabled=true) {
    this.breakpoints.push{filename,lineno,enabled};
    this.view.componentUpdate();
    this.notify("breakpoints",this.breakpoints);
  }
  removeBreakpoint(filename,lineno) {
    this.breakpoints = this.breakpoints.filter(item => item.filename != filename || item.lineno != lineno );
    this.view.componentUpdate();
    this.notify("breakpoints",this.breakpoints);
  }
  updateBreakpoint(breakpoint) {
    this.view.componentUpdate();
    this.notify("breakpoints",this.breakpoints);
  }


  static all = {}; // by key 
  static current = null; // current channel

  static factory(outboundRq) 
  {
    return new ChannelDriver(outboundRq);
  }

  // particular message drivers 
  
  static logs(payload) {
    for(var logItem of payload)
      this.theirLogs.push({key:uuid(),subsystem:logItem[0],severity:logItem[1],items:logItem[2]});
    document.dispatchEvent(new Event("log-new", {detail:this}), true);
  }

  static hello(theirId) {
    this.key = theirId; 
    ChannelDriver.all[theirId] = this;
    ChannelDriver.current = this;
    document.dispatchEvent(new Event("channel-new"),true);
  }

  static snapshot(imageBytes) {
    if(this.onSnapshotBytes)
      this.onSnapshotBytes(imageBytes);
  }

  static highlighted(stack) {
    if(this.onStackHighlight)
      this.onStackHighlight(stack);
  }

  static files(rsdefs) {
    for(var rd of rsdefs)
      this.theirFiles[rd.rqUrl] = rd;
    document.dispatchEvent(new Event("file-new"), true);
  }

  static atBreakpoint(breakpoint) {
    let [filename,lineno,callstack] = breakpoint;
    this.atBreakpoint = true;
    this.callstack = callstack;
    ++this.variablesId;
    this.view.onBreakpointHit(filename,lineno);
  }

  atBreakpointResponse(command,data) {
    if(command == "step") { 
      this.atBreakpoint = false; 
      this.view.requestUpdate(); 
    }
    this.notify("atBreakpointResponse", [command,data]); // ["step",1]
  }

  static frameVariables(variables) {
    this.variables = variables;
    this.view.componentUpdate();
  }


}

