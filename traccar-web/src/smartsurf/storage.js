import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { sessionActions } from '../store';
import fetchOrThrow from '../common/util/fetchOrThrow';
import {
  ATTR,
  defaultDeviceMappings,
  defaultGear,
  defaultIncidents,
  defaultRider,
  defaultSafety,
  defaultSessions,
  parseJsonAttribute,
  serializeAttribute,
  toArray,
} from './domain';

export const useSmartSurfData = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const [saving, setSaving] = useState(false);

  const data = useMemo(() => {
    const attributes = user?.attributes || {};
    return {
      rider: parseJsonAttribute(attributes, ATTR.rider, defaultRider),
      safety: parseJsonAttribute(attributes, ATTR.safety, defaultSafety),
      gear: parseJsonAttribute(attributes, ATTR.gear, defaultGear),
      deviceMappings: parseJsonAttribute(attributes, ATTR.devices, defaultDeviceMappings),
      sessions: parseJsonAttribute(attributes, ATTR.sessions, defaultSessions),
      incidents: parseJsonAttribute(attributes, ATTR.incidents, defaultIncidents),
    };
  }, [user]);

  const saveAttributes = async (patch) => {
    setSaving(true);
    try {
      const nextUser = {
        ...user,
        attributes: {
          ...(user.attributes || {}),
          ...Object.fromEntries(
            Object.entries(patch).map(([key, value]) => [key, serializeAttribute(value)]),
          ),
        },
      };
      const response = await fetchOrThrow(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextUser),
      });
      dispatch(sessionActions.updateUser(await response.json()));
    } finally {
      setSaving(false);
    }
  };

  const positionList = toArray(positions);
  const selectedPosition = selectedDeviceId
    ? positionList.find((position) => position.deviceId === selectedDeviceId)
    : positionList[0];

  return {
    user,
    devices,
    positions: positionList,
    selectedDeviceId,
    selectedPosition,
    saving,
    ...data,
    saveRider: (rider) => saveAttributes({ [ATTR.rider]: rider }),
    saveSafety: (safety) => saveAttributes({ [ATTR.safety]: safety }),
    saveGear: (gear) => saveAttributes({ [ATTR.gear]: gear }),
    saveDeviceMappings: (deviceMappings) => saveAttributes({ [ATTR.devices]: deviceMappings }),
    saveSessions: (sessions) => saveAttributes({ [ATTR.sessions]: sessions }),
    saveIncidents: (incidents) => saveAttributes({ [ATTR.incidents]: incidents }),
  };
};
