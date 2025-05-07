document.addEventListener('DOMContentLoaded', function() {
  // 标签切换
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.dataset.tab;
      
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      this.classList.add('active');
      document.getElementById(tabName).classList.add('active');
      
      if (tabName === 'projects') {
        loadProjects();
      } else if (tabName === 'submit') {
        loadProjectsForSubmit();
      }
    });
  });
  
  // 加载项目列表
  function loadProjects() {
    const projectsList = document.getElementById('projects-list');
    
    chrome.storage.local.get('projects', function(data) {
      const projects = data.projects || [];
      
      if (projects.length === 0) {
        projectsList.innerHTML = '<p>暂无项目配置，请添加。</p>';
        return;
      }
      
      let html = '';
      
      projects.forEach((project, index) => {
        html += `
          <div class="project-item">
            <div class="project-header">
              <strong>${project.name}</strong>
              <div class="project-actions">
                <button class="edit-project-button" data-index="${index}">编辑</button>
                <button class="delete-project-button delete-button" data-index="${index}">删除</button>
              </div>
            </div>
            <div>
              <p><strong>组ID:</strong> ${project.group_id}</p>
              <p><strong>数据库:</strong> ${project.db_name}</p>
              <p><strong>环境:</strong> ${project.environments.join(', ')}</p>
            </div>
          </div>
        `;
      });
      
      projectsList.innerHTML = html;
      
      // 绑定编辑和删除按钮事件
      document.querySelectorAll('.edit-project-button').forEach(button => {
        button.addEventListener('click', function() {
          const index = this.dataset.index;
          editProject(index);
        });
      });
      
      document.querySelectorAll('.delete-project-button').forEach(button => {
        button.addEventListener('click', function() {
          const index = this.dataset.index;
          deleteProject(index);
        });
      });
    });
  }
  
  // 加载项目下拉列表（提交表单用）
  function loadProjectsForSubmit() {
    const projectSelect = document.getElementById('project-select');
    
    chrome.storage.local.get('projects', function(data) {
      const projects = data.projects || [];
      
      let options = '<option value="">请选择项目</option>';
      
      projects.forEach((project, index) => {
        options += `<option value="${index}">${project.name}</option>`;
      });
      
      projectSelect.innerHTML = options;
    });
  }
  
  // 项目选择变化时，加载环境复选框
  document.getElementById('project-select').addEventListener('change', function() {
    const projectIndex = this.value;
    const environmentsContainer = document.getElementById('environments-container');
    
    if (!projectIndex) {
      environmentsContainer.innerHTML = '';
      return;
    }
    
    chrome.storage.local.get('projects', function(data) {
      const projects = data.projects || [];
      const project = projects[projectIndex];
      
      if (!project) return;
      
      let html = '<div class="checkbox-group">';
      
      project.environments.forEach(env => {
        html += `
          <label>
            <input type="checkbox" class="env-checkbox" value="${env}">
            ${env}
          </label>
        `;
      });
      
      html += '</div>';
      
      environmentsContainer.innerHTML = html;
    });
  });
  
  // 添加项目按钮
  document.getElementById('add-project-button').addEventListener('click', function() {
    document.getElementById('project-form').style.display = 'block';
    document.getElementById('project-name').value = '';
    document.getElementById('group-id').value = '';
    document.getElementById('db-name').value = '';
    document.getElementById('environments').value = '';
    document.getElementById('instances-container').innerHTML = '';
    
    // 清除编辑状态
    document.getElementById('project-form').dataset.mode = 'add';
    document.getElementById('project-form').dataset.index = '';
  });
  
  // 环境输入变化时，动态生成实例ID输入框
  document.getElementById('environments').addEventListener('blur', function() {
    const environments = this.value.split(',').map(env => env.trim()).filter(env => env);
    const instancesContainer = document.getElementById('instances-container');
    
    if (environments.length === 0) {
      instancesContainer.innerHTML = '';
      return;
    }
    
    let html = '<h3>环境实例配置</h3>';
    
    environments.forEach(env => {
      html += `
        <div class="instance-group">
          <h4>${env}</h4>
          <div id="instances-${env}">
            <div class="instance-row">
              <input type="text" class="instance-id" data-env="${env}" placeholder="实例ID">
              <button class="add-instance-button add-button" data-env="${env}">+</button>
            </div>
          </div>
        </div>
      `;
    });
    
    instancesContainer.innerHTML = html;
    
    // 绑定添加实例按钮事件
    document.querySelectorAll('.add-instance-button').forEach(button => {
      button.addEventListener('click', function() {
        const env = this.dataset.env;
        const container = document.getElementById(`instances-${env}`);
        
        const row = document.createElement('div');
        row.className = 'instance-row';
        row.innerHTML = `
          <input type="text" class="instance-id" data-env="${env}" placeholder="实例ID">
          <button class="delete-instance-button delete-button">-</button>
        `;
        
        container.appendChild(row);
        
        // 绑定删除实例按钮事件
        row.querySelector('.delete-instance-button').addEventListener('click', function() {
          row.remove();
        });
      });
    });
  });
  
  // 保存项目按钮
  document.getElementById('save-project-button').addEventListener('click', function() {
    const name = document.getElementById('project-name').value.trim();
    const groupId = document.getElementById('group-id').value.trim();
    const dbName = document.getElementById('db-name').value.trim();
    const environments = document.getElementById('environments').value.split(',').map(env => env.trim()).filter(env => env);
    
    if (!name || !groupId || !dbName || environments.length === 0) {
      alert('请填写完整信息');
      return;
    }
    
    // 收集实例ID
    const instances = {};
    
    environments.forEach(env => {
      const instanceInputs = document.querySelectorAll(`.instance-id[data-env="${env}"]`);
      instances[env] = [];
      
      instanceInputs.forEach(input => {
        const instanceId = input.value.trim();
        if (instanceId) {
          instances[env].push(instanceId);
        }
      });
    });
    
    // 检查每个环境是否至少有一个实例ID
    for (const env of environments) {
      if (instances[env].length === 0) {
        alert(`环境 ${env} 至少需要一个实例ID`);
        return;
      }
    }
    
    const project = {
      name,
      group_id: groupId,
      db_name: dbName,
      environments,
      instances
    };
    
    chrome.storage.local.get('projects', function(data) {
      let projects = data.projects || [];
      const mode = document.getElementById('project-form').dataset.mode;
      
      if (mode === 'edit') {
        const index = parseInt(document.getElementById('project-form').dataset.index);
        projects[index] = project;
      } else {
        projects.push(project);
      }
      
      chrome.storage.local.set({ projects }, function() {
        document.getElementById('project-form').style.display = 'none';
        loadProjects();
      });
    });
  });
  
  // 取消按钮
  document.getElementById('cancel-project-button').addEventListener('click', function() {
    document.getElementById('project-form').style.display = 'none';
  });
  
  // 编辑项目
  function editProject(index) {
    chrome.storage.local.get('projects', function(data) {
      const projects = data.projects || [];
      const project = projects[index];
      
      if (!project) return;
      
      document.getElementById('project-name').value = project.name;
      document.getElementById('group-id').value = project.group_id;
      document.getElementById('db-name').value = project.db_name;
      document.getElementById('environments').value = project.environments.join(', ');
      
      // 触发环境输入的blur事件，生成实例ID输入框
      const event = new Event('blur');
      document.getElementById('environments').dispatchEvent(event);
      
      // 填充实例ID
      setTimeout(() => {
        for (const env in project.instances) {
          const instances = project.instances[env];
          const container = document.getElementById(`instances-${env}`);
          
          if (!container) continue;
          
          // 清除默认生成的一行
          container.innerHTML = '';
          
          instances.forEach(instanceId => {
            const row = document.createElement('div');
            row.className = 'instance-row';
            row.innerHTML = `
              <input type="text" class="instance-id" data-env="${env}" value="${instanceId}" placeholder="实例ID">
              <button class="delete-instance-button delete-button">-</button>
            `;
            
            container.appendChild(row);
            
            // 绑定删除实例按钮事件
            row.querySelector('.delete-instance-button').addEventListener('click', function() {
              row.remove();
            });
          });
          
          // 添加一个添加按钮
          const addRow = document.createElement('div');
          addRow.className = 'instance-row';
          addRow.innerHTML = `
            <button class="add-instance-button add-button" data-env="${env}">添加实例</button>
          `;
          
          container.appendChild(addRow);
          
          // 绑定添加实例按钮事件
          addRow.querySelector('.add-instance-button').addEventListener('click', function() {
            const row = document.createElement('div');
            row.className = 'instance-row';
            row.innerHTML = `
              <input type="text" class="instance-id" data-env="${env}" placeholder="实例ID">
              <button class="delete-instance-button delete-button">-</button>
            `;
            
            addRow.before(row);
            
            // 绑定删除实例按钮事件
            row.querySelector('.delete-instance-button').addEventListener('click', function() {
              row.remove();
            });
          });
        }
      }, 100);
      
      document.getElementById('project-form').style.display = 'block';
      document.getElementById('project-form').dataset.mode = 'edit';
      document.getElementById('project-form').dataset.index = index;
    });
  }
  
  // 删除项目
  function deleteProject(index) {
    if (confirm('确定要删除该项目吗？')) {
      chrome.storage.local.get('projects', function(data) {
        let projects = data.projects || [];
        projects.splice(index, 1);
        
        chrome.storage.local.set({ projects }, function() {
          loadProjects();
        });
      });
    }
  }
  
  // 提交按钮
  document.getElementById('submit-button').addEventListener('click', function() {
    const projectIndex = document.getElementById('project-select').value;
    const workflowName = document.getElementById('workflow-name').value.trim();
    const sqlContent = document.getElementById('sql-content').value.trim();
    const demandUrl = document.getElementById('demand-url').value.trim();
    const isBackup = document.getElementById('is-backup').checked;
    
    const selectedEnvs = [];
    document.querySelectorAll('.env-checkbox:checked').forEach(checkbox => {
      selectedEnvs.push(checkbox.value);
    });
    
    if (!projectIndex || !workflowName || !sqlContent || selectedEnvs.length === 0) {
      alert('请填写完整信息并至少选择一个环境');
      return;
    }
    
    chrome.storage.local.get('projects', function(data) {
      const projects = data.projects || [];
      const project = projects[projectIndex];
      
      if (!project) return;
      
      // 获取当前标签的URL，用于后续获取CSRF令牌
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = new URL(tabs[0].url);
        const domain = currentUrl.origin;
        
        // 开始批量提交
        const submitStatus = document.getElementById('submit-status');
        submitStatus.innerHTML = '开始提交工单...';
        submitStatus.className = '';
        
        let completed = 0;
        let failed = 0;
        const total = selectedEnvs.reduce((sum, env) => sum + project.instances[env].length, 0);
        
        // 对选中的每个环境，每个实例提交工单
        selectedEnvs.forEach(env => {
          const instances = project.instances[env] || [];
          
          instances.forEach(instanceId => {
            // 构建请求数据
            const requestData = {
              workflow: {
                workflow_name: `${workflowName}`,
                demand_url: demandUrl,
                group_id: project.group_id,
                instance: instanceId,
                db_name: project.db_name,
                is_backup: isBackup,
                run_date_start: "",
                run_date_end: ""
              },
              sql_content: sqlContent.replace(/'/g, "\'")
            };
            
            console.log('正在准备请求:', `${domain}/api/v1/workflow/`);
            console.log('请求数据:', JSON.stringify(requestData));
            
            // 通过内容脚本发送请求
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'submitWorkflow',
              domain: domain,
              requestData: requestData
            }, function(response) {
              if (chrome.runtime.lastError) {
                console.error('发送消息时出错:', chrome.runtime.lastError);
                failed++;
              } else if (response && response.success) {
                completed++;
              } else {
                failed++;
                if (response && response.errorMsg) {
                  console.error(`环境 ${env} 实例 ${instanceId} 提交失败:`, response.errorMsg);
                  alert('报错内容：' + JSON.stringify(response.errorData || response.errorMsg));
                }
              }

              // 更新提交状态
              if (completed + failed === total) {
                if (failed === 0) {
                  submitStatus.innerHTML = `所有工单提交成功（共 ${total} 个）`;
                  submitStatus.className = 'status-success';
                } else {
                  submitStatus.innerHTML = `部分工单提交失败（成功: ${completed}，失败: ${failed}）`;
                  submitStatus.className = 'status-error';
                }
              } else {
                submitStatus.innerHTML = `正在提交...（已完成: ${completed + failed}/${total}）`;
              }
            });
          });
        });
      });
    });
  });
  
  
  // 添加批量选择环境按钮的事件处理
  document.getElementById('select-all-env').addEventListener('click', function() {
    document.querySelectorAll('.env-checkbox').forEach(checkbox => {
      checkbox.checked = true;
    });
  });

  document.getElementById('select-none-env').addEventListener('click', function() {
    document.querySelectorAll('.env-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
  });

  document.getElementById('select-test-env').addEventListener('click', function() {
    document.querySelectorAll('.env-checkbox').forEach(checkbox => {
      checkbox.checked = checkbox.value.includes('test') || checkbox.value.includes('测试');
    });
  });

  document.getElementById('select-prod-env').addEventListener('click', function() {
    document.querySelectorAll('.env-checkbox').forEach(checkbox => {
      checkbox.checked = checkbox.value.includes('online') || checkbox.value.includes('onl') || 
                        checkbox.value.includes('prod') || checkbox.value.includes('生产');
    });
  });
  
  // 初始加载
  loadProjectsForSubmit();
}); 