var lsKeys={token:"token"},page={token:localStorage[lsKeys.token],urlPrefix:null,urlIdentifier:null,messageElement:document.querySelector("#message"),fileinfoContainer:document.querySelector("#fileinfo"),clipboardBtn:document.querySelector("#clipboardBtn"),playerBtn:document.querySelector("#playerBtn"),downloadBtn:document.querySelector("#downloadBtn"),deleteBtn:document.querySelector("#deleteBtn"),uploadRoot:null,titleFormat:null,file:null,clipboardJS:null,updateMessageBody:function(e){page.messageElement.querySelector(".message-body").innerHTML=e,page.messageElement.classList.remove("is-hidden")},onError:function(e){console.error(e),page.updateMessageBody("\n    <p><strong>An error occurred!</strong></p>\n    <p><code>"+e.toString()+"</code></p>\n    <p>Please check your console for more information.</p>\n  ")},onAxiosError:function(e){var t={520:"Unknown Error",521:"Web Server Is Down",522:"Connection Timed Out",523:"Origin Is Unreachable",524:"A Timeout Occurred",525:"SSL Handshake Failed",526:"Invalid SSL Certificate",527:"Railgun Error",530:"Origin DNS Error"}[e.response.status]||e.response.statusText,a=e.response.data&&e.response.data.description?e.response.data.description:"";page.updateMessageBody("\n    <p><strong>"+e.response.status+" "+t+"</strong></p>\n    <p>"+a+"</p>\n  ")},deleteFile:function(){if(page.file){var e=document.createElement("div");e.innerHTML="<p>You won't be able to recover this file!</p>",swal({title:"Are you sure?",content:e,icon:"warning",dangerMode:!0,buttons:{cancel:!0,confirm:{text:"Yes, nuke it!",closeModal:!1}}}).then((function(e){e&&axios.post("../api/upload/delete",{id:page.file.id}).then((function(e){if(e){if(!1===e.data.success)return swal("An error occurred!",e.data.description,"error");(Array.isArray(e.data.failed)?e.data.failed:[]).length?swal("An error occurred!","Unable to delete this file.","error"):swal("Deleted!","This file has been deleted.","success",{buttons:!1})}})).catch(page.onAxiosError)}))}},loadFileinfo:function(){page.urlIdentifier&&axios.get("../api/upload/get/"+page.urlIdentifier).then((function(e){if(![200,304].includes(e.status))return page.onAxiosError(e);page.file=e.data.file,page.titleFormat&&(document.title=page.titleFormat.replace(/%identifier%/g,page.file.name));for(var t="",a=Object.keys(page.file),n=0;n<a.length;n++){var o=page.file[a[n]],r="";o&&(["size"].includes(a[n])?r=page.getPrettyBytes(o):["timestamp","expirydate"].includes(a[n])&&(r=page.getPrettyDate(new Date(1e3*o)))),t+='\n        <tr>\n          <th class="capitalize">'+a[n]+"</th>\n          <td>"+o+"</td>\n          <td>"+r+"</td>\n        </tr>\n      "}document.querySelector("#title").innerText=page.file.name,page.fileinfoContainer.querySelector(".table-container").innerHTML='\n      <div class="table-container has-text-left">\n        <table id="statistics" class="table is-fullwidth is-hoverable">\n          <thead>\n            <tr>\n              <th>Fields</th>\n              <td>Values</td>\n              <td></td>\n            </tr>\n          </thead>\n          <tbody>\n            '+t+"\n          </tbody>\n        </table>\n      </div>\n    ";var i=page.uploadRoot+"/"+page.file.name;page.downloadBtn.setAttribute("href",i),page.clipboardBtn.dataset.clipboardText=i;var l=page.fileinfoContainer.querySelector("img");l.setAttribute("alt",page.file.name||""),l.src=page.uploadRoot+"/"+page.file.name,l.parentNode.classList.remove("is-hidden"),l.onerror=function(e){return e.currentTarget.parentNode.classList.add("is-hidden")};var s=page.file.type.startsWith("video/"),d=page.file.type.startsWith("audio/");(s||d)&&(page.playerBtn.setAttribute("href","../v/"+page.file.name),page.playerBtn.parentNode.parentNode.classList.remove("is-hidden")),page.fileinfoContainer.classList.remove("is-hidden"),page.messageElement.classList.add("is-hidden"),page.urlParams.has("delete")&&page.deleteBtn.click()})).catch((function(e){void 0!==e.response?page.onAxiosError(e):page.onError(e)}))}};window.addEventListener("DOMContentLoaded",(function(){window.URLSearchParams=window.URLSearchParams||function(e){var t=this;t.has=function(e){return null!=new RegExp("[?&]"+e).exec(t.searchString)}},axios.defaults.headers.common.token=page.token;var e=document.querySelector("#mainScript");if(e&&void 0!==e.dataset.uploadRoot){page.uploadRoot=e.dataset.uploadRoot,page.titleFormat=e.dataset.titleFormat;var t=window.location.protocol+"//"+window.location.host,a=window.location.pathname.match(/.*\/(.*)$/);if(!a||!a[1])return page.updateMessageBody("<p>Failed to parse upload identifier from URL.</p>");page.urlIdentifier=a[1],t+=window.location.pathname.substring(0,window.location.pathname.indexOf(a[1])),page.urlPrefix=t,page.urlParams=new URLSearchParams(window.location.search),page.clipboardJS=new ClipboardJS(".clipboard-js"),page.clipboardJS.on("success",(function(){return swal("","The link has been copied to clipboard.","success",{buttons:!1,timer:1500})})),page.clipboardJS.on("error",page.onError),page.deleteBtn.addEventListener("click",page.deleteFile),page.loadFileinfo()}}));
//# sourceMappingURL=file.js.map
