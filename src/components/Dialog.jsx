import React, {createContext, useContext, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './dialog.css';

// All dialogs share one stack, including dialogs rendered through different
// portals. Only the top layer receives focus or Escape.
const dialogs = [];
const ParentDialog = createContext(null);
const savedInert = new Map();
let observer, returnToPage, previousOverflow;
const focusSelector = 'button,input,select,textarea,a[href],area[href],summary,iframe,audio[controls],video[controls],[tabindex],[contenteditable="true"]';

function canFocus(element) {
  return element instanceof HTMLElement && element.isConnected && !element.closest('[inert]') &&
    !element.matches(':disabled') && element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== 'hidden';
}
function focus(element) { if (canFocus(element)) element.focus({preventScroll:true}); }
function candidates(panel) {
  return [...panel.querySelectorAll(focusSelector)].filter(element=>canFocus(element)&&element.tabIndex>=0)
    .sort((a,b)=>(a.tabIndex>0?a.tabIndex:Infinity)-(b.tabIndex>0?b.tabIndex:Infinity));
}
function syncLayers() {
  const top = dialogs.at(-1);
  for (const element of document.body.children) {
    if (!(element instanceof HTMLElement)) continue;
    if (!savedInert.has(element)) savedInert.set(element,element.getAttribute('inert'));
    if (top && element !== top.host) element.inert = true;
    else {
      const original = savedInert.get(element);
      if (original === null) element.removeAttribute('inert'); else element.setAttribute('inert',original);
    }
  }
  dialogs.forEach((dialog,index)=>{dialog.host.style.zIndex=String(10000+index);});
  if (!top) {
    for (const [element,original] of savedInert) {
      if (original === null) element.removeAttribute('inert'); else element.setAttribute('inert',original);
    }
    savedInert.clear();
  }
}
function keydown(event) {
  const top = dialogs.at(-1);
  if (!top || event.isComposing) return;
  if (event.key === 'Escape') {
    event.preventDefault(); event.stopPropagation(); top.close(); return;
  }
  if (event.key !== 'Tab') return;
  const items = candidates(top.panel), first = items[0], last = items.at(-1), active = document.activeElement;
  if (!first) {event.preventDefault(); focus(top.panel);}
  else if (event.shiftKey && (active===first || !items.includes(active))) {event.preventDefault(); focus(last);}
  else if (!event.shiftKey && (active===last || !items.includes(active))) {event.preventDefault(); focus(first);}
}
function focusin(event) {
  const top = dialogs.at(-1);
  if (top && !top.panel.contains(event.target)) top.focus();
}
function workspaceNavigation() { dialogs.at(-1)?.close(); }

/** A labelled, portalled modal. A missing/guarded onClose keeps a busy dialog open. */
export default function Dialog({open=true,onClose,labelledBy,describedBy,className='',initialFocusRef,children}) {
  const parent = useContext(ParentDialog), identity = useRef(Symbol('dialog'));
  const [host] = useState(()=>{const node=document.createElement('div');node.className='duet-dialog-root';return node;});
  const panel = useRef(null), closeRef = useRef(onClose), initialRef = useRef(initialFocusRef);
  closeRef.current=onClose; initialRef.current=initialFocusRef;
  useLayoutEffect(()=>{
    if (!open) return;
    const returnFocus = document.activeElement;
    document.body.append(host);
    const entry={identity:identity.current,parent,host,panel:panel.current,returnFocus,close:()=>closeRef.current?.(),focus:()=>{
      const requested=initialRef.current?.current;
      focus(requested&&entry.panel.contains(requested)&&canFocus(requested)?requested:candidates(entry.panel)[0]||entry.panel);
    }};
    if (!dialogs.length) {
      returnToPage=returnFocus; previousOverflow=document.body.style.overflow;
      document.body.style.overflow='hidden';
      document.addEventListener('keydown',keydown,true); document.addEventListener('focusin',focusin,true);
      window.addEventListener('duetblox:workspace-navigation',workspaceNavigation);
      observer=new MutationObserver(syncLayers); observer.observe(document.body,{childList:true});
    }
    // React runs child layout effects first when parent and child open together.
    // Insert the parent below its descendants rather than covering the child.
    const childIndex=dialogs.findIndex(dialog=>dialog.parent===entry.identity);
    dialogs.splice(childIndex<0?dialogs.length:childIndex,0,entry); syncLayers(); dialogs.at(-1).focus();
    return ()=>{
      const wasTop=dialogs.at(-1)===entry, index=dialogs.indexOf(entry);
      if(index>=0)dialogs.splice(index,1);
      host.remove(); syncLayers();
      if (!dialogs.length) {
        observer?.disconnect(); observer=null;
        document.removeEventListener('keydown',keydown,true); document.removeEventListener('focusin',focusin,true);
        window.removeEventListener('duetblox:workspace-navigation',workspaceNavigation);
        document.body.style.overflow=previousOverflow;
        focus(canFocus(returnFocus)?returnFocus:returnToPage); returnToPage=null;
      } else if (wasTop) {
        const next=dialogs.at(-1);
        if(next.panel.contains(returnFocus)&&canFocus(returnFocus))focus(returnFocus);else next.focus();
      }
    };
  },[open,host,parent]);
  return open?createPortal(<ParentDialog.Provider value={identity.current}><div className="duet-dialog-backdrop"><section ref={panel} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} tabIndex={-1} className={`duet-dialog-panel ${className}`}>{children}</section></div></ParentDialog.Provider>,host):null;
}
