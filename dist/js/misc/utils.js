lsKeys.siBytes="siBytes",lsKeys.ampmTime="ampmTime",page.prepareShareX=function(){var e=document.querySelector("#ShareX");if(e){var t={};page.token&&(t.token=page.token||"",t.albumid=page.album||""),t.filelength=page.fileLength||"",t.age=page.uploadAge||"",t.striptags=page.stripTags||"";var a=(window.location.host+window.location.pathname).replace(/\/(dashboard)?$/,""),r=a.replace(/\//g,"_"),o={Name:r,DestinationType:"ImageUploader, FileUploader",RequestMethod:"POST",RequestURL:window.location.protocol+"//"+a+"/api/upload",Headers:t,Body:"MultipartFromData",FileFormName:"files[]",URL:"$json:files[0].url$",ThumbnailURL:"$json:files[0].url$"},i=JSON.stringify(o,null,2),n=new Blob([i],{type:"application/octet-binary"});e.setAttribute("href",URL.createObjectURL(n)),e.setAttribute("download",r+".sxcu")}},page.getPrettyDate=function(e){return e.getFullYear()+"/"+(e.getMonth()<9?"0":"")+(e.getMonth()+1)+"/"+(e.getDate()<10?"0":"")+e.getDate()+" "+e.toLocaleString("en",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:"1"===localStorage[lsKeys.ampmTime]})},page.getPrettyBytes=function(e){if("number"!=typeof e&&!isFinite(e))return e;var t="0"!==localStorage[lsKeys.siBytes],a=e<0?"-":"",r=t?1e3:1024;if(a&&(e=-e),e<r)return""+a+e+" B";var o=Math.min(Math.floor(Math.log(e)*Math.LOG10E/3),8);return""+a+Number((e/Math.pow(r,o)).toPrecision(3))+" "+((t?"kMGTPEZY":"KMGTPEZY").charAt(o-1)+(t?"":"i"))+"B"},page.getPrettyUptime=function(e){var t=Math.floor(e/86400);e%=86400;var a=Math.floor(e/3600);e%=3600;var r=Math.floor(e/60);return a<10&&(a="0"+a),r<10&&(r="0"+r),(e%=60)<10&&(e="0"+e),t>0?t+"d "+a+":"+r+":"+e:a+":"+r+":"+e},page.escape=function(e){if(!e)return e;var t,a=String(e),r=/["'&<>]/.exec(a);if(!r)return a;var o="",i=0,n=0;for(i=r.index;i<a.length;i++){switch(a.charCodeAt(i)){case 34:t="&quot;";break;case 38:t="&amp;";break;case 39:t="&#39;";break;case 60:t="&lt;";break;case 62:t="&gt;";break;default:continue}n!==i&&(o+=a.substring(n,i)),n=i+1,o+=t}return n!==i?o+a.substring(n,i):o};
//# sourceMappingURL=utils.js.map
