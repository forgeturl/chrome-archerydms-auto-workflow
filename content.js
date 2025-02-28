// 这个文件暂时不需要实现具体功能
// 因为我们通过chrome.cookies API直接获取CSRF令牌 

// 监听来自popup.js的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'submitWorkflow') {
    const domain = request.domain;
    const requestData = request.requestData;
    
    // 获取CSRF令牌
    const csrfToken = document.cookie.split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
    
    if (!csrfToken) {
      sendResponse({
        success: false,
        errorMsg: '无法获取CSRF令牌，请确保您已登录Archery'
      });
      return true;
    }
    
    // 发送请求
    fetch(`${domain}/api/v1/workflow/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(requestData),
      credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
      if (data.status === 0) {
        sendResponse({success: true});
      } else {
        sendResponse({
          success: false,
          errorMsg: data.msg || '未知错误',
          errorData: data
        });
      }
    })
    .catch(error => {
      sendResponse({
        success: false,
        errorMsg: error.toString()
      });
    });
    
    return true; // 表示将异步发送响应
  }
}); 