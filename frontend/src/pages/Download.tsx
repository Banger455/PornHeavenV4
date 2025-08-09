import { Fragment, useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { ConfigType } from './Home';
import loadDownloadQueue from '../api/loader/loadDownloadQueue';
import { OutletContextType } from './Base';
import Pagination, { PaginationType } from '../components/Pagination';
import { ViewStylesEnum } from '../configuration/constants/ViewStyle';
import updateDownloadQueue from '../api/actions/updateDownloadQueue';
import Notifications from '../components/Notifications';
import ScrollToTopOnNavigate from '../components/ScrollToTop';
import Button from '../components/Button';
import DownloadListItem from '../components/DownloadListItem';
import loadDownloadAggs, { DownloadAggsType } from '../api/loader/loadDownloadAggs';
import { useUserConfigStore } from '../stores/UserConfigStore';
import { ApiResponseType } from '../functions/APIClient';
import deleteDownloadQueueByFilter from '../api/actions/deleteDownloadQueueByFilter';
import updateDownloadQueueByFilter, {
  DownloadQueueStatus,
} from '../api/actions/updateDownloadQueueByFilter';

type Download = {
  auto_start: boolean;
  channel_id: string;
  channel_indexed: boolean;
  channel_name: string;
  duration: string;
  message?: string;
  published: string | null;
  status: string;
  timestamp: number | null;
  title: string;
  vid_thumb_url: string;
  vid_type: string;
  youtube_id: string;
  _index: string;
  _score: number;
};

export type DownloadResponseType = {
  data?: Download[];
  config?: ConfigType;
  paginate?: PaginationType;
};

const Download = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { userConfig, setUserConfig } = useUserConfigStore();
  const { currentPage, setCurrentPage } = useOutletContext() as OutletContextType;

  const channelFilterFromUrl = searchParams.get('channel');
  const ignoredOnlyParam = searchParams.get('ignored');
  const vidTypeFilterFromUrl = searchParams.get('vid-type');
  const errorFilterFromUrl = searchParams.get('error');

  const [refresh, setRefresh] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const [lastVideoCount, setLastVideoCount] = useState(0);

  const [downloadQueueText, setDownloadQueueText] = useState('');

  const [downloadResponse, setDownloadResponse] = useState<ApiResponseType<DownloadResponseType>>();
  const [downloadAggsResponse, setDownloadAggsResponse] =
    useState<ApiResponseType<DownloadAggsType>>();

  const { data: downloadResponseData } = downloadResponse ?? {};
  const { data: downloadAggsResponseData } = downloadAggsResponse ?? {};

  const downloadList = downloadResponseData?.data;
  const pagination = downloadResponseData?.paginate;
  const channelAggsList = downloadAggsResponseData?.buckets;

  const downloadCount = pagination?.total_hits;

  const channel_filter_name =
    downloadResponseData?.data?.length && downloadResponseData?.data?.length > 0
      ? downloadResponseData?.data[0].channel_name
      : '';

  const viewStyle = userConfig.view_style_downloads;
  const gridItems = userConfig.grid_items;
  const showIgnored =
    ignoredOnlyParam !== null ? ignoredOnlyParam === 'true' : userConfig.show_ignored_only;

  const showIgnoredFilter = showIgnored ? 'ignore' : 'pending';

  const isGridView = viewStyle === ViewStylesEnum.Grid;
  const gridView = isGridView ? `boxed-${gridItems}` : '';
  const gridViewGrid = isGridView ? `grid-${gridItems}` : '';


  useEffect(() => {
    (async () => {
      if (refresh) {
        const videosResponse = await loadDownloadQueue(
          currentPage,
          channelFilterFromUrl,
          vidTypeFilterFromUrl,
          errorFilterFromUrl,
          showIgnored,
          searchInput,
        );
        const { data: channelResponseData } = videosResponse ?? {};
        const videoCount = channelResponseData?.paginate?.total_hits;

        if (videoCount && lastVideoCount !== videoCount) {
          setLastVideoCount(videoCount);
        }

        setDownloadResponse(videosResponse);
        setRefresh(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  useEffect(() => {
    setRefresh(true);
  }, [
    channelFilterFromUrl,
    vidTypeFilterFromUrl,
    errorFilterFromUrl,
    currentPage,
    showIgnored,
    searchInput,
  ]);

  useEffect(() => {
    (async () => {
      const downloadAggs = await loadDownloadAggs(showIgnored);

      setDownloadAggsResponse(downloadAggs);
    })();
  }, [lastVideoCount, showIgnored]);

  const handleBulkStatusUpdate = async (status: DownloadQueueStatus) => {
    await updateDownloadQueueByFilter(
      showIgnoredFilter,
      channelFilterFromUrl,
      vidTypeFilterFromUrl,
      errorFilterFromUrl,
      status,
    );
    setRefresh(true);
  };

  return (
    <>
      <title>TA | Downloads</title>
      <ScrollToTopOnNavigate />
      <div className="boxed-content">
        <div className="title-bar">
          <h1>Downloads {channelFilterFromUrl && ` for ${channel_filter_name}`}</h1>
        </div>
        <Notifications
          pageName="download"
        />
        <div id="downloadControl"></div>
        <div className="info-box">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={downloadQueueText}
              onChange={e => setDownloadQueueText(e.target.value)}
              placeholder="Füge eine Video-URL ein (YouTube, Pornhub, …)"
              style={{ flex: 1 }}
            />
            <Button
              label="Download"
              onClick={async () => {
                if (downloadQueueText.trim()) {
                  await updateDownloadQueue(downloadQueueText.trim(), true, false);
                  setDownloadQueueText('');
                  setRefresh(true);
                }
              }}
            />
          </div>
        </div>
        <h3>
          Total videos in queue: {downloadCount}
          {downloadCount == 10000 && '+'}{' '}
          {channelFilterFromUrl && (
            <>
              {' - from channel '}
              <i>{channel_filter_name}</i>
            </>
          )}
          {vidTypeFilterFromUrl && (
            <>
              {' - by type '}
              <i>{vidTypeFilterFromUrl}</i>
            </>
          )}
        </h3>
      </div>

      <div className={`boxed-content ${gridView}`}>
        <div className={`video-list ${viewStyle} ${gridViewGrid}`}>
          {downloadList &&
            downloadList?.map(download => {
              return (
                <Fragment
                  key={`${download.channel_id}_${download.timestamp}_${download.youtube_id}`}
                >
                  <DownloadListItem download={download} setRefresh={setRefresh} />
                </Fragment>
              );
            })}
        </div>
      </div>

      <div className="boxed-content">
        {pagination && <Pagination pagination={pagination} setPage={setCurrentPage} />}
      </div>
    </>
  );
};

export default Download;
