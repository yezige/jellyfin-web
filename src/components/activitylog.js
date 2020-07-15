import events from 'events';
import globalize from 'globalize';
import dom from 'dom';
import * as datefns from 'date-fns';
import dfnshelper from 'dfnshelper';
import userSettings from 'userSettings';
import serverNotifications from 'serverNotifications';
import connectionManager from 'connectionManager';
import 'emby-button';
import 'listViewStyle';

/*eslint-disable indent */

    function getEntryHtml(entry, apiClient) {
        var html = '';
        html += '<div class="listItem listItem-border">';
        var color = '#00a4dc';
        var icon = 'notifications';

        if ('Error' == entry.Severity || 'Fatal' == entry.Severity || 'Warn' == entry.Severity) {
            color = '#cc0000';
            icon = 'notification_important';
        }

        if (entry.UserId && entry.UserPrimaryImageTag) {
            html += '<span class="listItemIcon material-icons dvr" style="width:2em!important;height:2em!important;padding:0;color:transparent;background-color:' + color + ";background-image:url('" + apiClient.getUserImageUrl(entry.UserId, {
                type: 'Primary',
                tag: entry.UserPrimaryImageTag
            }) + "');background-repeat:no-repeat;background-position:center center;background-size: cover;\"></span>";
        } else {
            html += '<span class="listItemIcon material-icons ' + icon + '" style="background-color:' + color + '"></span>';
        }

        html += '<div class="listItemBody three-line">';
        html += '<div class="listItemBodyText">';
        html += entry.Name;
        html += '</div>';
        html += '<div class="listItemBodyText secondary">';
        html += datefns.formatRelative(Date.parse(entry.Date), Date.parse(new Date()), { locale: dfnshelper.getLocale() });
        html += '</div>';
        html += '<div class="listItemBodyText secondary listItemBodyText-nowrap">';
        html += entry.ShortOverview || '';
        html += '</div>';
        html += '</div>';

        if (entry.Overview) {
            html += `<button type="button" is="paper-icon-button-light" class="btnEntryInfo" data-id="${entry.Id}" title="${globalize.translate('Info')}">
                       <span class="material-icons info"></span>
                    </button>`;
        }

        html += '</div>';

        return html;
    }

    function renderList(elem, apiClient, result, startIndex, limit) {
        elem.innerHTML = result.Items.map(function (i) {
            return getEntryHtml(i, apiClient);
        }).join('');
    }

    function reloadData(instance, elem, apiClient, startIndex, limit) {
        if (null == startIndex) {
            startIndex = parseInt(elem.getAttribute('data-activitystartindex') || '0');
        }

        limit = limit || parseInt(elem.getAttribute('data-activitylimit') || '7');
        var minDate = new Date();
        var hasUserId = 'false' !== elem.getAttribute('data-useractivity');

        if (hasUserId) {
            minDate.setTime(minDate.getTime() - 24 * 60 * 60 * 1000); // one day back
        } else {
            minDate.setTime(minDate.getTime() - 7 * 24 * 60 * 60 * 1000); // one week back
        }

        ApiClient.getJSON(ApiClient.getUrl('System/ActivityLog/Entries', {
            startIndex: startIndex,
            limit: limit,
            minDate: minDate.toISOString(),
            hasUserId: hasUserId
        })).then(function (result) {
            elem.setAttribute('data-activitystartindex', startIndex);
            elem.setAttribute('data-activitylimit', limit);
            if (!startIndex) {
                var activityContainer = dom.parentWithClass(elem, 'activityContainer');

                if (activityContainer) {
                    if (result.Items.length) {
                        activityContainer.classList.remove('hide');
                    } else {
                        activityContainer.classList.add('hide');
                    }
                }
            }

            instance.items = result.Items;
            renderList(elem, apiClient, result, startIndex, limit);
        });
    }

    function onActivityLogUpdate(e, apiClient, data) {
        var options = this.options;

        if (options && options.serverId === apiClient.serverId()) {
            reloadData(this, options.element, apiClient);
        }
    }

    function onListClick(e) {
        var btnEntryInfo = dom.parentWithClass(e.target, 'btnEntryInfo');

        if (btnEntryInfo) {
            var id = btnEntryInfo.getAttribute('data-id');
            var items = this.items;

            if (items) {
                var item = items.filter(function (i) {
                    return i.Id.toString() === id;
                })[0];

                if (item) {
                    showItemOverview(item);
                }
            }
        }
    }

    function showItemOverview(item) {
        require(['alert'], function (alert) {
            alert({
                text: item.Overview
            });
        });
    }

class ActivityLog {
    constructor(options) {
        console.log(options)
        this.options = options;
        var element = options.element;
        element.classList.add('activityLogListWidget');
        element.addEventListener('click', onListClick.bind(this));
        var apiClient = connectionManager.getApiClient(options.serverId);
        reloadData(this, element, apiClient);
        var onUpdate = onActivityLogUpdate.bind(this);
        this.updateFn = onUpdate;
        events.on(serverNotifications, 'ActivityLogEntry', onUpdate);
        apiClient.sendMessage('ActivityLogEntryStart', '0,1500');
    }
    destroy() {
        var options = this.options;

        if (options) {
            options.element.classList.remove('activityLogListWidget');
            connectionManager.getApiClient(options.serverId).sendMessage('ActivityLogEntryStop', '0,1500');
        }

        var onUpdate = this.updateFn;

        if (onUpdate) {
            events.off(serverNotifications, 'ActivityLogEntry', onUpdate);
        }

        this.items = null;
        this.options = null;
    }
}

export default ActivityLog;

/*eslint-enable indent */
